import { describe, expect, it } from 'vitest';

import { planEviction, sortByEvictionOrder } from '../../src/pool/eviction.js';
import { EmptyPoolState, type PoolEntry, type PoolState } from '../../src/pool/types.js';

function entry(overrides: Partial<PoolEntry> = {}): PoolEntry {
  return {
    ollamaName: 'qwen3:32b',
    hfRepoId: 'Qwen/Qwen3-32B-GGUF',
    sizeOnDiskGb: 10,
    installedAt: '2026-05-01T00:00:00.000Z',
    lastUsedAt: '2026-05-28T12:00:00.000Z',
    currentScore: 60,
    ...overrides,
  };
}

function stateOf(entries: PoolEntry[], diskBudgetGb = 100): PoolState {
  const base = EmptyPoolState();
  return {
    ...base,
    diskBudgetGb,
    entries,
    diskUsedGb: entries.reduce((s, e) => s + e.sizeOnDiskGb, 0),
  };
}

describe('planEviction', () => {
  it('returns the empty plan when the budget is zero', () => {
    const state = stateOf([entry()]);
    expect(planEviction({ state, freeBudgetGb: 0 })).toEqual({
      evict: [],
      freedGb: 0,
      remainingNeededGb: 0,
    });
  });

  it('returns the empty plan when the budget is negative (defensive)', () => {
    const state = stateOf([entry()]);
    expect(planEviction({ state, freeBudgetGb: -5 })).toEqual({
      evict: [],
      freedGb: 0,
      remainingNeededGb: 0,
    });
  });

  it('reports the shortfall when the pool has no entries', () => {
    const state = stateOf([]);
    const plan = planEviction({ state, freeBudgetGb: 12 });
    expect(plan.evict).toEqual([]);
    expect(plan.freedGb).toBe(0);
    expect(plan.remainingNeededGb).toBe(12);
  });

  it('evicts the single lowest-score entry when it exactly satisfies the budget', () => {
    const low = entry({ ollamaName: 'lo', currentScore: 30, sizeOnDiskGb: 5 });
    const high = entry({ ollamaName: 'hi', currentScore: 80, sizeOnDiskGb: 12 });
    const state = stateOf([high, low]);
    const plan = planEviction({ state, freeBudgetGb: 5 });
    expect(plan.evict.map((e) => e.ollamaName)).toEqual(['lo']);
    expect(plan.freedGb).toBe(5);
    expect(plan.remainingNeededGb).toBe(0);
  });

  it('keeps accumulating entries until the budget is met', () => {
    const a = entry({ ollamaName: 'a', currentScore: 20, sizeOnDiskGb: 4 });
    const b = entry({ ollamaName: 'b', currentScore: 40, sizeOnDiskGb: 6 });
    const c = entry({ ollamaName: 'c', currentScore: 90, sizeOnDiskGb: 15 });
    const state = stateOf([c, a, b]);
    const plan = planEviction({ state, freeBudgetGb: 9 });
    expect(plan.evict.map((e) => e.ollamaName)).toEqual(['a', 'b']);
    expect(plan.freedGb).toBe(10);
    expect(plan.remainingNeededGb).toBe(0);
  });

  it('breaks score ties on older lastUsedAt first (null is oldest)', () => {
    const never = entry({
      ollamaName: 'never',
      currentScore: 50,
      lastUsedAt: null,
      sizeOnDiskGb: 3,
    });
    const recent = entry({
      ollamaName: 'recent',
      currentScore: 50,
      lastUsedAt: '2026-05-28T00:00:00.000Z',
      sizeOnDiskGb: 3,
    });
    const older = entry({
      ollamaName: 'older',
      currentScore: 50,
      lastUsedAt: '2026-05-01T00:00:00.000Z',
      sizeOnDiskGb: 3,
    });

    const ordered = sortByEvictionOrder([recent, older, never]).map((e) => e.ollamaName);
    expect(ordered).toEqual(['never', 'older', 'recent']);
  });

  it('breaks score+lastUsed ties on older installedAt first', () => {
    const newer = entry({
      ollamaName: 'newer',
      currentScore: 70,
      lastUsedAt: '2026-05-20T00:00:00.000Z',
      installedAt: '2026-05-15T00:00:00.000Z',
    });
    const older = entry({
      ollamaName: 'older',
      currentScore: 70,
      lastUsedAt: '2026-05-20T00:00:00.000Z',
      installedAt: '2026-04-01T00:00:00.000Z',
    });
    expect(sortByEvictionOrder([newer, older]).map((e) => e.ollamaName)).toEqual([
      'older',
      'newer',
    ]);
  });

  it('returns every entry with remainingNeededGb when the pool cannot satisfy the budget', () => {
    const a = entry({ ollamaName: 'a', currentScore: 10, sizeOnDiskGb: 2 });
    const b = entry({ ollamaName: 'b', currentScore: 20, sizeOnDiskGb: 3 });
    const state = stateOf([a, b]);
    const plan = planEviction({ state, freeBudgetGb: 100 });
    expect(plan.evict.map((e) => e.ollamaName).sort()).toEqual(['a', 'b']);
    expect(plan.freedGb).toBe(5);
    expect(plan.remainingNeededGb).toBe(95);
  });

  it('does not mutate the input state', () => {
    const entries = [
      entry({ ollamaName: 'a', currentScore: 10 }),
      entry({ ollamaName: 'b', currentScore: 90 }),
    ];
    const state = stateOf(entries);
    const originalOrder = state.entries.map((e) => e.ollamaName);
    planEviction({ state, freeBudgetGb: 8 });
    expect(state.entries.map((e) => e.ollamaName)).toEqual(originalOrder);
  });
});
