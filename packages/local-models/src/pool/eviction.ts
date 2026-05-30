/**
 * `planEviction` — lowest-score-LRU eviction planner.
 *
 * Per D14 the v1 policy is hardcoded: no `evictionPolicy` config enum, no
 * strategy registry. This function is the only policy implementation that
 * ships. When a second concrete use case appears, the seam is the function
 * signature itself — `EvictionRequest` already includes a `now` parameter
 * for a future cooldown-aware policy.
 *
 * The function is pure: given the same state + budget it returns the same
 * plan. It never mutates the input, never touches the filesystem, and never
 * throws on legitimate inputs (negative budgets, empty pools).
 *
 * @see docs/changes/local-model-lifecycle-manager/proposal.md (D14, line 63)
 */

import type { EvictionPlan, PoolEntry, PoolState } from './types.js';

/**
 * Inputs to the planner. `state` is the current pool (clone returned by
 * `PoolStateStore.snapshot`); `freeBudgetGb` is the disk we need to free
 * before the caller's pending install can proceed. `now` is reserved for a
 * future cooldown-aware policy and is intentionally unused today.
 */
export interface EvictionRequest {
  state: PoolState;
  freeBudgetGb: number;
  /**
   * Reserved for a future second policy (e.g. lowest-score-with-cooldown).
   * The v1 lowest-score-LRU rule sorts on `lastUsedAt`, which is already
   * absolute, so the clock is not consulted today.
   */
  now?: () => number;
}

/**
 * Plan which entries to evict to free `freeBudgetGb`. Ordering rules:
 *
 *   1. Lowest `currentScore` evicted first.
 *   2. Equal scores ⇒ oldest `lastUsedAt` first. `null` is treated as oldest
 *      (a freshly-installed entry the resolver has never picked up — the
 *      safest thing to remove first when nothing else distinguishes it).
 *   3. Equal scores + equal lastUsed ⇒ oldest `installedAt` first.
 *
 * Stops accumulating once cumulative `sizeOnDiskGb >= freeBudgetGb`. If no
 * single entry meets the budget but the pool has at least one entry, evicts
 * the single lowest-scoring entry — the caller can decide whether to retry
 * with a larger budget or surface an error.
 *
 * On empty pool ⇒ `{ evict: [], freedGb: 0, remainingNeededGb: freeBudgetGb }`.
 * On zero/negative budget ⇒ `{ evict: [], freedGb: 0, remainingNeededGb: 0 }`.
 */
export function planEviction(request: EvictionRequest): EvictionPlan {
  const budget = Math.max(0, request.freeBudgetGb);
  if (budget === 0) {
    return { evict: [], freedGb: 0, remainingNeededGb: 0 };
  }

  const sorted = sortByEvictionOrder(request.state.entries);
  if (sorted.length === 0) {
    return { evict: [], freedGb: 0, remainingNeededGb: budget };
  }

  const evict: PoolEntry[] = [];
  let freedGb = 0;
  for (const entry of sorted) {
    evict.push(entry);
    freedGb += entry.sizeOnDiskGb;
    if (freedGb >= budget) break;
  }
  // OT8 smallest-needed eviction: if the loop never satisfied the budget but
  // we did evict at least the smallest entry (which the for-of above always
  // does once sorted is non-empty), surface what's still missing so the
  // caller can decide whether to abort or retry.
  const remainingNeededGb = Math.max(0, budget - freedGb);
  return { evict, freedGb, remainingNeededGb };
}

/**
 * Stable sort of pool entries in eviction order. Exposed for tests so the
 * ordering rules can be asserted directly without going through `planEviction`.
 */
export function sortByEvictionOrder(entries: PoolEntry[]): PoolEntry[] {
  return [...entries].sort(compareEvictionOrder);
}

function compareEvictionOrder(a: PoolEntry, b: PoolEntry): number {
  if (a.currentScore !== b.currentScore) {
    return a.currentScore - b.currentScore;
  }
  const lastUsedDelta = lastUsedAtRank(a) - lastUsedAtRank(b);
  if (lastUsedDelta !== 0) return lastUsedDelta;
  return installedAtRank(a) - installedAtRank(b);
}

function lastUsedAtRank(entry: PoolEntry): number {
  // `null` ranks oldest so unused fresh installs evict first when scores tie.
  if (entry.lastUsedAt === null) return 0;
  const ms = Date.parse(entry.lastUsedAt);
  return Number.isNaN(ms) ? 0 : ms;
}

function installedAtRank(entry: PoolEntry): number {
  const ms = Date.parse(entry.installedAt);
  return Number.isNaN(ms) ? 0 : ms;
}
