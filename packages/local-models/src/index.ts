/**
 * @harness-engineering/local-models
 *
 * Hardware-aware local-model recommender, pool manager, and proposal engine
 * for Harness Engineering's Local Model Lifecycle Manager (LMLM).
 *
 * Phase 2a (current) adds the HuggingFace REST client, an on-disk cache,
 * and the frozen benchmark snapshot loader on top of Phase 1's hardware
 * detection. Subsequent phases add the VRAM/speed math, evidence/recency
 * fusion, the algorithm port, the pool manager, the Ollama installer, the
 * scheduler, the proposal engine, and the HTTP/WS/CLI/dashboard surfaces per
 * `docs/changes/local-model-lifecycle-manager/proposal.md`.
 */

export const LOCAL_MODELS_PACKAGE = '@harness-engineering/local-models' as const;
export const LOCAL_MODELS_VERSION = '0.1.0' as const;

export * from './hardware/index.js';
export * from './huggingface/index.js';
export * from './ranker/index.js';
