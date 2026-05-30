import { describe, expect, it } from 'vitest';

import {
  HALFLIFE_MONTHS,
  LINEAGE_STEP_PENALTY,
  MIN_RECENCY_WEIGHT,
  applyRecencyDecay,
} from '../../src/ranker/recency.js';

const SNAPSHOT_DATE = '2026-05-29T00:00:00.000Z';

/** Helper: subtract N months from the snapshot date using the same MS_PER_MONTH the module uses. */
function monthsBefore(snapshot: string, months: number): string {
  const snapshotMs = Date.parse(snapshot);
  const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30;
  return new Date(snapshotMs - months * MS_PER_MONTH).toISOString();
}

describe('applyRecencyDecay — exponential age decay (OT3)', () => {
  it('returns weight === 1.0 when observation equals snapshot date', () => {
    const result = applyRecencyDecay({
      observedAt: SNAPSHOT_DATE,
      snapshotDate: SNAPSHOT_DATE,
    });
    expect(result.ageMonths).toBe(0);
    expect(result.weight).toBeCloseTo(1, 9);
  });

  it('demotes a 12-month-old observation into the [0.3, 0.7] band', () => {
    const result = applyRecencyDecay({
      observedAt: monthsBefore(SNAPSHOT_DATE, 12),
      snapshotDate: SNAPSHOT_DATE,
    });
    expect(result.ageMonths).toBeCloseTo(12, 1);
    expect(result.weight).toBeLessThanOrEqual(0.7);
    expect(result.weight).toBeGreaterThanOrEqual(0.3);
  });

  it('demotes a 24-month-old observation below 0.4', () => {
    const result = applyRecencyDecay({
      observedAt: monthsBefore(SNAPSHOT_DATE, 24),
      snapshotDate: SNAPSHOT_DATE,
    });
    expect(result.weight).toBeLessThanOrEqual(0.4);
  });

  it('halves the weight every HALFLIFE_MONTHS', () => {
    const fresh = applyRecencyDecay({
      observedAt: SNAPSHOT_DATE,
      snapshotDate: SNAPSHOT_DATE,
    });
    const halfLifeOld = applyRecencyDecay({
      observedAt: monthsBefore(SNAPSHOT_DATE, HALFLIFE_MONTHS),
      snapshotDate: SNAPSHOT_DATE,
    });
    expect(halfLifeOld.weight / fresh.weight).toBeCloseTo(0.5, 2);
  });

  it('clamps future-dated observations to age 0 (weight === 1)', () => {
    const future = new Date(Date.parse(SNAPSHOT_DATE) + 30 * 24 * 60 * 60 * 1000).toISOString();
    const result = applyRecencyDecay({ observedAt: future, snapshotDate: SNAPSHOT_DATE });
    expect(result.ageMonths).toBe(0);
    expect(result.weight).toBeCloseTo(1, 9);
  });
});

describe('applyRecencyDecay — lineage step penalty (OT4)', () => {
  it('produces a strictly lower weight at lineagePosition 1 vs 0', () => {
    const here = applyRecencyDecay({
      observedAt: SNAPSHOT_DATE,
      snapshotDate: SNAPSHOT_DATE,
      lineagePosition: 0,
    });
    const oneBack = applyRecencyDecay({
      observedAt: SNAPSHOT_DATE,
      snapshotDate: SNAPSHOT_DATE,
      lineagePosition: 1,
    });
    expect(oneBack.weight).toBeLessThan(here.weight);
    expect(oneBack.lineagePenaltyApplied).toBeCloseTo(LINEAGE_STEP_PENALTY, 9);
    expect(here.lineagePenaltyApplied).toBe(1);
  });

  it('compounds: lineagePosition 2 is strictly lower than position 1', () => {
    const one = applyRecencyDecay({
      observedAt: SNAPSHOT_DATE,
      snapshotDate: SNAPSHOT_DATE,
      lineagePosition: 1,
    });
    const two = applyRecencyDecay({
      observedAt: SNAPSHOT_DATE,
      snapshotDate: SNAPSHOT_DATE,
      lineagePosition: 2,
    });
    expect(two.weight).toBeLessThan(one.weight);
    expect(two.lineagePenaltyApplied).toBeCloseTo(LINEAGE_STEP_PENALTY ** 2, 9);
  });

  it('clamps at MIN_RECENCY_WEIGHT for ancient + deeply-lagged observations', () => {
    const ancient = applyRecencyDecay({
      observedAt: monthsBefore(SNAPSHOT_DATE, 60),
      snapshotDate: SNAPSHOT_DATE,
      lineagePosition: 5,
    });
    expect(ancient.weight).toBe(MIN_RECENCY_WEIGHT);
  });

  it('treats undefined lineagePosition as no penalty', () => {
    const noHint = applyRecencyDecay({
      observedAt: SNAPSHOT_DATE,
      snapshotDate: SNAPSHOT_DATE,
    });
    expect(noHint.lineagePenaltyApplied).toBe(1);
  });
});

describe('applyRecencyDecay — degenerate inputs never throw', () => {
  it('returns a finite weight for malformed ISO inputs (clamps to ageMonths = 0)', () => {
    const result = applyRecencyDecay({
      observedAt: 'not-a-date',
      snapshotDate: SNAPSHOT_DATE,
    });
    expect(Number.isFinite(result.weight)).toBe(true);
    expect(result.weight).toBeGreaterThanOrEqual(MIN_RECENCY_WEIGHT);
  });
});
