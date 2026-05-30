/**
 * Pool — public barrel.
 *
 * Phase 3a stands up the persistence primitive (`PoolStateStore`) and the
 * `lowestScoreLru` eviction planner. The installer interface, the
 * `PoolManager` orchestration layer, and the resolver wiring land in
 * Phases 3b–4.
 */

export {
  PoolStateStore,
  DEFAULT_POOL_STATE_PATH,
  POOL_STATE_VERSION,
  isPoolStateFile,
} from './state.js';
export type { PoolFilesystem, PoolStateFile, PoolStateStoreOptions } from './state.js';

export { planEviction, sortByEvictionOrder } from './eviction.js';
export type { EvictionRequest } from './eviction.js';

export { EmptyPoolState } from './types.js';
export type { EvictionCandidate, EvictionPlan, PoolEntry, PoolState } from './types.js';
