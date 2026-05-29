/**
 * Bandwidth-bound token-throughput estimator.
 *
 * Autoregressive transformer decoding is memory-bandwidth-bound on every
 * mainstream consumer backend: each new token requires streaming the *active*
 * weight set from memory once, and the rest of the math (attention, MLP,
 * softmax) overlaps with that read. The first-order estimate the spec asks
 * for therefore collapses to
 *
 *   tokPerSec ≈ effectiveBandwidthGbps × backendEfficiency ÷ activeWeightsGb
 *
 * with three calibration knobs we can refine without rewriting the equation:
 *
 *  - `backendEfficiency` — fraction of peak bandwidth the runtime actually
 *    realises (MLX hits a higher fraction than CPU; vLLM higher than ollama
 *    on the same NVIDIA card).
 *  - `effectiveBandwidthGbps` — blended GPU↔CPU bandwidth when the model
 *    spills past `hardware.vramGb`, weighted by `partialOffloadFraction`.
 *  - `activeWeightsGb` — for MoE, only the routed experts touch memory per
 *    token, so we size off `activeB`, not the total.
 *
 * Apple Silicon's unified memory short-circuits the partial-offload penalty:
 * if the footprint fits in unified memory, there is no PCIe transfer to pay
 * for. The unified-memory check is the only platform-specific branch in this
 * file; everything else is platform-agnostic math.
 *
 * @see docs/changes/local-model-lifecycle-manager/proposal.md (Phase 2, lines 414–429)
 */

import type { HardwareProfile } from '../hardware/types.js';
import { normalizeQuantId, type NormalizedQuant } from './quants.js';
import type { VramEstimate } from './vram.js';

/** Local-runtime targets the speed estimator differentiates. */
export type SpeedBackend = 'ollama' | 'llama-cpp' | 'mlx' | 'vllm' | 'cpu';

/**
 * Realised fraction of peak memory bandwidth, per backend. Seeded from
 * public benchmarks of llama.cpp / MLX / vLLM at the v1.0 release of LMLM;
 * Phase 2d parity fixtures pin these against whichllm reference outputs so
 * drift surfaces in CI. Constants live here so retuning is a one-line change.
 */
export const BACKEND_EFFICIENCY: Readonly<Record<SpeedBackend, number>> = {
  ollama: 0.55,
  'llama-cpp': 0.55,
  mlx: 0.7,
  vllm: 0.65,
  cpu: 0.35,
};

/**
 * Conservative DDR5-desktop floor used as the CPU side of the partial-offload
 * blend. Real CPU bandwidth ranges from ~50 GB/s (DDR5 desktop) to ~400 GB/s
 * (server EPYC); we pick the desktop floor because it matches the dominant
 * operator profile and keeps the partial-offload penalty conservative.
 */
export const CPU_BANDWIDTH_FLOOR_GBPS = 60;

/** Partial-offload share above which we drop confidence to `'low'`. */
const LOW_CONFIDENCE_OFFLOAD_THRESHOLD = 0.5;

/** Input to `estimateSpeed`. */
export interface SpeedEstimateInput {
  /** Total parameter count in billions. Used only for the MoE fallback when `activeB` is absent. */
  sizeB: number;
  /** Active parameter count in billions for MoE. Drives the throughput math when present. */
  activeB?: number;
  /** Quant id — same vocabulary `estimateVram` accepts. */
  quant: string;
  /** Platform / bandwidth profile from `HardwareDetector`. */
  hardware: HardwareProfile;
  /** Pre-computed footprint from `estimateVram`. The estimator needs `totalGb` for partial-offload + the won't-fit check. */
  vramEstimate: VramEstimate;
  /**
   * Override the default backend selection. Default mapping:
   * `macos → mlx`, `nvidia → llama-cpp`, `cpu → cpu`. Callers wanting an
   * `ollama` projection on an NVIDIA box pass it explicitly.
   */
  backend?: SpeedBackend;
}

/**
 * Result of `estimateSpeed`. Returns the projected throughput plus enough
 * provenance for the ranker to produce a human-readable justification ("falls
 * to 7 t/s because 49% of the weights spill to CPU at 60 GB/s").
 */
export interface SpeedEstimate {
  /** Tokens per second the runtime is projected to deliver. `0` when the model won't fit at all. */
  tokPerSec: number;
  /** Confidence band: `'high'` for full-fit on a known quant; downgrades for partial offload, unknown quants, CPU. */
  confidence: 'high' | 'medium' | 'low';
  /** Blended bandwidth used in the math. Equals `hardware.bandwidthGbps` when the model fits. */
  effectiveBandwidthGbps: number;
  /** GB streamed per token — sized off `activeB ?? sizeB`. */
  activeWeightsGb: number;
  /** 0 when the model fits in VRAM; 1 when it runs entirely on system RAM; in between for partial offload. */
  partialOffloadFraction: number;
  /** Backend used in the estimate (after the default selection). */
  backend: SpeedBackend;
}

/** Default backend per platform. Callers can override via `SpeedEstimateInput.backend`. */
function defaultBackend(platform: HardwareProfile['platform']): SpeedBackend {
  if (platform === 'macos') return 'mlx';
  if (platform === 'nvidia') return 'llama-cpp';
  return 'cpu';
}

/**
 * Compute `partialOffloadFraction` — the share of weights spilling out of
 * VRAM into system RAM. `0` for full-fit. `1` for CPU-only or won't-fit.
 * Linear in the spillover so the blended-bandwidth math stays first-order.
 */
function computePartialOffloadFraction(
  hardware: HardwareProfile,
  vramEstimate: VramEstimate
): number {
  if (hardware.platform === 'cpu') return 1;
  if (vramEstimate.totalGb <= hardware.vramGb) return 0;
  // Apple Silicon: unified memory means VRAM = system RAM; spillover behaves
  // like an NVIDIA card running past its VRAM but without the PCIe penalty.
  // We still surface the fraction so the ranker can downgrade confidence; the
  // bandwidth blend uses the same CPU floor because once we exceed unified
  // memory we're swapping, and swap bandwidth is dramatically lower than DRAM.
  const overflow = vramEstimate.totalGb - hardware.vramGb;
  const fraction = overflow / vramEstimate.totalGb;
  return Math.min(fraction, 1);
}

/**
 * Project token-generation throughput. Always succeeds — won't-fit cases
 * return `tokPerSec: 0`, `confidence: 'low'` rather than throwing, so the
 * ranker can still include the candidate in its diff with a clear
 * justification.
 */
export function estimateSpeed(input: SpeedEstimateInput): SpeedEstimate {
  const backend = input.backend ?? defaultBackend(input.hardware.platform);
  const quantInfo: NormalizedQuant = normalizeQuantId(input.quant);
  const activeParamsB = input.activeB ?? input.sizeB;
  const activeWeightsGb = (activeParamsB * quantInfo.bitsPerWeight) / 8;

  // Won't-fit even with full RAM spillover: short-circuit. The ranker can
  // still display this candidate; it just won't recommend installing it.
  const totalAvailableGb = input.hardware.vramGb + input.hardware.ramGb;
  if (input.vramEstimate.totalGb > totalAvailableGb) {
    return {
      tokPerSec: 0,
      confidence: 'low',
      effectiveBandwidthGbps: 0,
      activeWeightsGb,
      partialOffloadFraction: 1,
      backend,
    };
  }

  const partialOffloadFraction = computePartialOffloadFraction(input.hardware, input.vramEstimate);

  // Blended bandwidth: GPU bandwidth weighted by the share that fits, CPU
  // floor weighted by the share that spills. On CPU-only platforms this
  // collapses to `CPU_BANDWIDTH_FLOOR_GBPS` (driven by the hardware profile's
  // own bandwidth report would let an EPYC host hit a higher number, but the
  // efficiency multiplier already accounts for that).
  const effectiveBandwidthGbps =
    input.hardware.bandwidthGbps * (1 - partialOffloadFraction) +
    CPU_BANDWIDTH_FLOOR_GBPS * partialOffloadFraction;

  const efficiency = BACKEND_EFFICIENCY[backend];
  // `activeWeightsGb` is positive by construction (sizeB and bitsPerWeight
  // both > 0 for any model the ranker would surface); guard anyway to keep
  // the estimator total for callers passing degenerate fixtures.
  const tokPerSec =
    activeWeightsGb > 0 ? (effectiveBandwidthGbps * efficiency) / activeWeightsGb : 0;

  const confidence = computeConfidence({
    partialOffloadFraction,
    backend,
    quantKnown: quantInfo.known,
  });

  return {
    tokPerSec,
    confidence,
    effectiveBandwidthGbps,
    activeWeightsGb,
    partialOffloadFraction,
    backend,
  };
}

function computeConfidence(args: {
  partialOffloadFraction: number;
  backend: SpeedBackend;
  quantKnown: boolean;
}): SpeedEstimate['confidence'] {
  if (args.backend === 'cpu') return 'low';
  if (args.partialOffloadFraction > LOW_CONFIDENCE_OFFLOAD_THRESHOLD) return 'low';
  if (!args.quantKnown) return 'low';
  if (args.partialOffloadFraction > 0) return 'medium';
  return 'high';
}
