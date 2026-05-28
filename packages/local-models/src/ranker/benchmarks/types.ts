/**
 * Benchmark data — public types.
 *
 * The ranker (Phase 2c) merges multiple benchmark sources into a single
 * `score` per model. Phase 2a only defines the shape and the frozen-snapshot
 * envelope; the source adapters and merge algorithm land in 2c.
 *
 * Evidence grading captures *how directly* a benchmark applies to the exact
 * `(model, quant)` pair the ranker is scoring. The grades are ordered from
 * strongest (`direct`) to weakest (`self-reported`); the merge weights each
 * accordingly.
 *
 * @see docs/changes/local-model-lifecycle-manager/proposal.md (lines 80–87, 132–137)
 */

/**
 * Evidence strength applied to a benchmark observation, in descending order
 * of trustworthiness:
 *
 * - `direct`        — leaderboard ran the exact `(model, quant)` pair
 * - `variant`       — leaderboard ran a different quant of the same model
 * - `base`          — leaderboard ran the unquantized base
 * - `interpolated`  — score inferred from sibling models on the same lineage
 * - `self-reported` — published only by the model author; not independently
 *                     verified
 */
export type BenchmarkEvidence = 'direct' | 'variant' | 'base' | 'interpolated' | 'self-reported';

/**
 * Single benchmark observation pulled from one source. `value` is the raw
 * benchmark score on the source's native scale; the merge logic in 2c
 * normalizes across sources.
 */
export interface BenchmarkObservation {
  /** Stable id of the originating leaderboard (`'open-llm-leaderboard'`, `'livebench'`, …). */
  source: string;
  /** Benchmark slug within the source (`'arc'`, `'mmlu'`, `'humaneval'`, `'livebench-coding'`, …). */
  benchmark: string;
  /** Native-scale score reported by the source. */
  value: number;
  /** Evidence grade describing how this observation maps to the target `(model, quant)`. */
  evidence: BenchmarkEvidence;
  /** ISO date the observation was published or last refreshed by the source. */
  observedAt: string;
}

/**
 * Per-model benchmark roll-up. The frozen snapshot ships these so the ranker
 * has a usable score even when the HF API and the live leaderboard sources
 * are unreachable (S4).
 */
export interface ModelBenchmark {
  /** Stable HF repo id (`'Qwen/Qwen3-32B-GGUF'`). */
  hfRepoId: string;
  /** Common Ollama name when the model is mirrored upstream; `undefined` until 2c populates the table. */
  ollamaName?: string;
  /** Human-readable family slug (`'qwen3'`, `'deepseek-r1'`, `'llama-3'`). */
  family: string;
  /** Total parameter count in billions. For MoE this is `total`. */
  sizeB: number;
  /** Active parameter count in billions for MoE; `undefined` for dense models. */
  activeB?: number;
  /** All observations contributing to this roll-up. May be empty in the seed snapshot. */
  observations: readonly BenchmarkObservation[];
}

/**
 * Snapshot envelope. `version` lets the 2c loader detect schema drift; a
 * mismatch causes the loader to surface a warning and return an empty
 * snapshot rather than risk feeding the ranker malformed data.
 */
export interface BenchmarkSnapshot {
  version: 1;
  /** ISO date the snapshot was generated. Drives 2c's recency demotion. */
  generatedAt: string;
  /** Provenance label: `'seed'` for the Phase 2a placeholder, `'snapshot'` once Phase 2c writes real data. */
  source: 'seed' | 'snapshot';
  models: readonly ModelBenchmark[];
}

/** Result returned by `loadFrozenSnapshot`. Always populated — never throws. */
export interface BenchmarkSnapshotLoadResult {
  snapshot: BenchmarkSnapshot;
  /** `'frozen'` when the bundled JSON parsed; `'fallback'` when the loader had to substitute an empty snapshot. */
  source: 'frozen' | 'fallback';
  warnings: BenchmarkSnapshotWarning[];
}

/** Structured warning attached to a load result. */
export interface BenchmarkSnapshotWarning {
  code: 'snapshot_read_failed' | 'snapshot_parse_failed' | 'snapshot_schema_invalid';
  message: string;
  cause?: string;
}

/** Helper used by both the loader fallback and 2c's emptied-on-mismatch path. */
export function emptySnapshot(generatedAt: string): BenchmarkSnapshot {
  return {
    version: 1,
    generatedAt,
    source: 'seed',
    models: [],
  };
}
