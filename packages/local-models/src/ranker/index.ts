/**
 * Ranker — public barrel.
 *
 * Phase 2a stands up the benchmark namespace; Phase 2b adds `vram` and
 * `speed`; Phase 2c adds `evidence`, `recency`, and the benchmark merge;
 * Phase 2d adds `algorithm.ts`. Re-exporting the benchmarks barrel now keeps
 * the public surface stable across phases.
 */

export * from './benchmarks/index.js';
