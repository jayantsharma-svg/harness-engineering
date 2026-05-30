/**
 * @harness-engineering/local-models
 *
 * Hardware-aware local-model recommender, pool manager, and proposal engine
 * for Harness Engineering's Local Model Lifecycle Manager (LMLM).
 *
 * Phase 3a (current) stands up the pool-state persistence primitive
 * (`PoolStateStore`, atomic tmp+rename writes to `~/.harness/local-models/
 * pool.json`) and the `lowestScoreLru` eviction planner, on top of Phase 1's
 * hardware detection, Phase 2a's HF client + cache + frozen snapshot loader,
 * and Phase 2b's VRAM + speed math. Subsequent phases add the evidence /
 * recency fusion + benchmark merge (2c), the algorithm port (2d), the Ollama
 * installer + `PoolManager` orchestration (3b), the resolver integration
 * (4), the proposal engine + schema generalization (5), the scheduler (6),
 * and the HTTP / WS / CLI / dashboard surfaces (7–8) per
 * `docs/changes/local-model-lifecycle-manager/proposal.md`.
 */

export const LOCAL_MODELS_PACKAGE = '@harness-engineering/local-models' as const;
export const LOCAL_MODELS_VERSION = '0.1.0' as const;

export * from './hardware/index.js';
export * from './huggingface/index.js';
export * from './pool/index.js';
export * from './ranker/index.js';
