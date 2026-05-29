/**
 * Benchmark data — public barrel.
 *
 * Phase 2a exposes the snapshot loader and the shared types. Phase 2c will
 * add `sources.ts` (live leaderboard adapters) and `merge.ts` (cross-source
 * weighting + confidence) under this same namespace.
 */

export { loadFrozenSnapshot } from './snapshot.js';

export {
  emptySnapshot,
  type BenchmarkEvidence,
  type BenchmarkObservation,
  type BenchmarkSnapshot,
  type BenchmarkSnapshotLoadResult,
  type BenchmarkSnapshotWarning,
  type ModelBenchmark,
} from './types.js';
