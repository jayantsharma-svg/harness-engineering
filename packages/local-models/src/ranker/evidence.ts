/**
 * Evidence grader for benchmark observations.
 *
 * The ranker (Phase 2d) folds many `BenchmarkObservation` records — pulled
 * from disparate sources for adjacent quants, sibling fine-tunes, and lineage
 * predecessors — into a single per-model score. The grader's job is to label
 * each observation by *how directly* it applies to the exact `(model, quant)`
 * the ranker is scoring so the merge in `./benchmarks/merge.ts` can weight
 * contributions consistently across sources.
 *
 * The grades land on a fixed confidence ladder (`EVIDENCE_CONFIDENCE`) seeded
 * to satisfy Q4 from the spec: at equal raw benchmark score, a `direct`
 * observation must outrank a `self-reported` one after the merge applies the
 * confidence multiplier. The constants live here so Phase 2d's parity fixtures
 * can retune them without touching every call site.
 *
 * Self-reported is an *absorbing* tag: once a source marks an observation
 * `self-reported`, no amount of model-id overlap can promote it back to
 * `direct`. This matches the proposal's evidence ordering (lines 80–87) —
 * unverified vendor claims stay unverified.
 *
 * @see docs/changes/local-model-lifecycle-manager/proposal.md (lines 80–87, 414–429)
 */

import { normalizeQuantId } from './quants.js';
import type { BenchmarkEvidence } from './benchmarks/types.js';

/**
 * Confidence multiplier per evidence grade. Calibrated so a `direct`
 * observation outranks a `self-reported` one of equal raw score even after
 * recency demotion, and so each ladder rung is meaningful (≥ 0.15 step
 * between adjacent grades). Phase 2d parity fixtures pin the constants
 * against the whichllm reference outputs.
 */
export const EVIDENCE_CONFIDENCE: Readonly<Record<BenchmarkEvidence, number>> = {
  direct: 1.0,
  variant: 0.85,
  base: 0.7,
  interpolated: 0.5,
  'self-reported': 0.35,
};

/** Output of `gradeEvidence`. */
export interface EvidenceGrade {
  /** Discrete evidence label per the proposal's ladder. */
  grade: BenchmarkEvidence;
  /** Confidence multiplier the merge applies to this observation's weight. */
  confidence: number;
}

/**
 * Input to `gradeEvidence`. Carries the observation's own model identity plus
 * the target the ranker is scoring; the grader compares the two.
 */
export interface EvidenceInput {
  /** Model id the source attached to the observation (`'Qwen/Qwen3-32B-GGUF'`). */
  observationModel: string;
  /** Quant the source attached to the observation, if any. */
  observationQuant?: string;
  /**
   * Source-declared evidence override. When the source flagged the
   * observation `self-reported`, the grader respects that label regardless of
   * the model-id match (vendor claims are not upgradable).
   */
  observationEvidence?: BenchmarkEvidence;
  /** Model id the ranker is currently scoring. */
  targetModel: string;
  /** Quant the ranker is currently scoring. */
  targetQuant?: string;
  /**
   * Optional lineage hint. `0` = same generation; `>= 1` = N generations
   * behind the target (e.g. `Qwen2.5` when target is on `Qwen3`). Used by
   * `interpolated` grading and surfaced for the recency module's separate
   * lineage penalty.
   */
  lineagePosition?: number;
}

/** Suffixes appended to GGUF / MLX / quantized mirrors. Stripped before model comparison. */
const QUANT_SUFFIXES = ['-GGUF', '-MLX', '-AWQ', '-GPTQ'] as const;

/** Suffixes added by fine-tune / variant labels. Stripped to recover the base model id. */
const VARIANT_SUFFIXES = ['-Instruct', '-Chat', '-it', '-Base'] as const;

/** Parameter-size suffix pattern (`-32B`, `-7B`, `-1.5B`, etc.). Stripped to recover the family root. */
const SIZE_SUFFIX_PATTERN = /-\d+(?:\.\d+)?B(?:-A\d+(?:\.\d+)?B)?$/i;

/**
 * Strip the trailing quantization mirror suffix (case-insensitive). Used so
 * `Qwen/Qwen3-32B-GGUF` and `Qwen/Qwen3-32B` collapse to one identity for
 * grading.
 */
function stripQuantSuffix(model: string): string {
  const lowered = model.toLowerCase();
  for (const suffix of QUANT_SUFFIXES) {
    if (lowered.endsWith(suffix.toLowerCase())) {
      return model.slice(0, model.length - suffix.length);
    }
  }
  return model;
}

/**
 * Reduce a model id to its family-root form: strip quant suffix, variant
 * suffix, and parameter-size suffix in order. `Qwen/Qwen3-32B-Instruct-GGUF`
 * → `Qwen/Qwen3`.
 */
function baseModelForm(model: string): string {
  let working = stripQuantSuffix(model);
  for (const suffix of VARIANT_SUFFIXES) {
    if (working.toLowerCase().endsWith(suffix.toLowerCase())) {
      working = working.slice(0, working.length - suffix.length);
    }
  }
  working = working.replace(SIZE_SUFFIX_PATTERN, '');
  return working;
}

/** Case-insensitive equality with both inputs normalized to a single form. */
function ciEquals(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Compare two quant strings via `normalizeQuantId` so canonical keys and
 * documented aliases (`'q4_k_m'` vs `'Q4_K_M'`) collapse to one match.
 * Returns `true` when both strings are present, both resolve to a known
 * canonical key, and the canonical keys agree.
 */
function quantsAgree(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const left = normalizeQuantId(a);
  const right = normalizeQuantId(b);
  if (!left.known || !right.known) return false;
  return left.canonical === right.canonical;
}

/**
 * Grade an observation against the ranker's current target. See module
 * docstring for the ladder semantics.
 */
export function gradeEvidence(input: EvidenceInput): EvidenceGrade {
  if (input.observationEvidence === 'self-reported') {
    return { grade: 'self-reported', confidence: EVIDENCE_CONFIDENCE['self-reported'] };
  }

  const observationStripped = stripQuantSuffix(input.observationModel);
  const targetStripped = stripQuantSuffix(input.targetModel);
  const sameIdentity = ciEquals(observationStripped, targetStripped);

  if (sameIdentity && quantsAgree(input.observationQuant, input.targetQuant)) {
    return { grade: 'direct', confidence: EVIDENCE_CONFIDENCE.direct };
  }

  if (sameIdentity) {
    return { grade: 'variant', confidence: EVIDENCE_CONFIDENCE.variant };
  }

  const observationBase = baseModelForm(input.observationModel);
  const targetBase = baseModelForm(input.targetModel);
  if (ciEquals(observationBase, targetBase)) {
    return { grade: 'base', confidence: EVIDENCE_CONFIDENCE.base };
  }

  return { grade: 'interpolated', confidence: EVIDENCE_CONFIDENCE.interpolated };
}
