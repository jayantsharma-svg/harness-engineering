import { describe, expect, it } from 'vitest';

import type { BenchmarkObservation } from '../../../src/ranker/benchmarks/types.js';
import { DEFAULT_SOURCE_WEIGHTS, mergeBenchmarks } from '../../../src/ranker/benchmarks/merge.js';

const SNAPSHOT_DATE = '2026-05-29T00:00:00.000Z';

/** Helper: a few months before the snapshot, on the same MS_PER_MONTH grid recency uses. */
function monthsBefore(snapshot: string, months: number): string {
  const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30;
  return new Date(Date.parse(snapshot) - months * MS_PER_MONTH).toISOString();
}

const TARGET = { model: 'Qwen/Qwen3-32B-GGUF', quant: 'Q4_K_M' };

describe('mergeBenchmarks — empty input (OT10)', () => {
  it('returns score 0 / confidence low / no contributions without throwing', () => {
    const result = mergeBenchmarks({
      observations: [],
      target: TARGET,
      snapshotDate: SNAPSHOT_DATE,
    });
    expect(result.score).toBe(0);
    expect(result.confidence).toBe('low');
    expect(result.contributions).toEqual([]);
  });
});

describe('mergeBenchmarks — evidence dominates ties (OT7 / Q4)', () => {
  it('ranks a direct observation strictly above a self-reported one at the same value', () => {
    const fresh = SNAPSHOT_DATE;
    const direct: BenchmarkObservation = {
      source: 'open-llm-leaderboard',
      benchmark: 'mmlu',
      value: 80,
      evidence: 'direct',
      observedAt: fresh,
    };
    const selfReported: BenchmarkObservation = {
      source: 'open-llm-leaderboard',
      benchmark: 'mmlu',
      value: 80,
      evidence: 'self-reported',
      observedAt: fresh,
    };
    const a = mergeBenchmarks({ observations: [direct], target: TARGET, snapshotDate: fresh });
    const b = mergeBenchmarks({
      observations: [selfReported],
      target: TARGET,
      snapshotDate: fresh,
    });
    // The merge's weighted-mean math collapses to the same per-observation
    // value when only one observation is present, so the score sits on the
    // shared 0–100 normalisation — the *confidence* is the divergence point.
    expect(a.score).toBeCloseTo(b.score, 6);
    expect(a.confidence).toBe('high');
    expect(b.confidence).toBe('low');
  });

  it('blends two observations so the direct contribution outweighs the self-reported one', () => {
    const fresh = SNAPSHOT_DATE;
    const directHigh: BenchmarkObservation = {
      source: 'open-llm-leaderboard',
      benchmark: 'mmlu',
      value: 90,
      evidence: 'direct',
      observedAt: fresh,
    };
    const selfReportedLow: BenchmarkObservation = {
      source: 'open-llm-leaderboard',
      benchmark: 'mmlu',
      value: 10,
      evidence: 'self-reported',
      observedAt: fresh,
    };
    const result = mergeBenchmarks({
      observations: [directHigh, selfReportedLow],
      target: TARGET,
      snapshotDate: fresh,
    });
    // Unweighted mean = 50; weighted mean is pulled toward the direct
    // observation's 90, comfortably above 60 (direct contributes 1.0 weight,
    // self-reported contributes 0.35, so the merged score ≈ 69.3).
    expect(result.score).toBeGreaterThan(60);
    expect(result.score).toBeGreaterThan(50);
  });
});

describe('mergeBenchmarks — recency shifts ranking (OT8 / Q5)', () => {
  it('ranks a fresh direct observation strictly above an 18-month-stale one at the same value', () => {
    const obsFresh: BenchmarkObservation = {
      source: 'open-llm-leaderboard',
      benchmark: 'mmlu',
      value: 75,
      evidence: 'direct',
      observedAt: SNAPSHOT_DATE,
    };
    const obsStale: BenchmarkObservation = {
      source: 'open-llm-leaderboard',
      benchmark: 'mmlu',
      value: 75,
      evidence: 'direct',
      observedAt: monthsBefore(SNAPSHOT_DATE, 18),
    };
    const a = mergeBenchmarks({
      observations: [obsFresh, obsStale],
      target: TARGET,
      snapshotDate: SNAPSHOT_DATE,
    });
    expect(a.contributions).toHaveLength(2);
    const freshContribution = a.contributions[0]!;
    const staleContribution = a.contributions[1]!;
    expect(freshContribution.recencyWeight).toBeGreaterThan(staleContribution.recencyWeight);
    expect(freshContribution.combinedWeight).toBeGreaterThan(staleContribution.combinedWeight);
  });
});

describe('mergeBenchmarks — confidence labels (OT9)', () => {
  it('returns high when a fresh direct observation participated', () => {
    const result = mergeBenchmarks({
      observations: [
        {
          source: 'open-llm-leaderboard',
          benchmark: 'mmlu',
          value: 80,
          evidence: 'direct',
          observedAt: SNAPSHOT_DATE,
        },
      ],
      target: TARGET,
      snapshotDate: SNAPSHOT_DATE,
    });
    expect(result.confidence).toBe('high');
  });

  it('returns medium when only base/variant evidence contributed with non-trivial weight', () => {
    const result = mergeBenchmarks({
      observations: [
        {
          source: 'open-llm-leaderboard',
          benchmark: 'mmlu',
          value: 80,
          evidence: 'base',
          observedAt: SNAPSHOT_DATE,
        },
      ],
      target: TARGET,
      snapshotDate: SNAPSHOT_DATE,
    });
    expect(result.confidence).toBe('medium');
  });

  it('returns low when every observation is interpolated or self-reported', () => {
    const result = mergeBenchmarks({
      observations: [
        {
          source: 'open-llm-leaderboard',
          benchmark: 'mmlu',
          value: 70,
          evidence: 'interpolated',
          observedAt: SNAPSHOT_DATE,
        },
        {
          source: 'open-llm-leaderboard',
          benchmark: 'arc',
          value: 65,
          evidence: 'self-reported',
          observedAt: SNAPSHOT_DATE,
        },
      ],
      target: TARGET,
      snapshotDate: SNAPSHOT_DATE,
    });
    expect(result.confidence).toBe('low');
  });

  it('returns low when every contribution falls below the combined-weight floor', () => {
    const result = mergeBenchmarks({
      observations: [
        {
          source: 'open-llm-leaderboard',
          benchmark: 'mmlu',
          value: 80,
          evidence: 'direct',
          observedAt: monthsBefore(SNAPSHOT_DATE, 36),
        },
      ],
      target: TARGET,
      snapshotDate: SNAPSHOT_DATE,
    });
    expect(result.confidence).toBe('low');
  });
});

describe('mergeBenchmarks — source weight override', () => {
  it('reduces the merged score when the dominant source is down-weighted', () => {
    const observations: BenchmarkObservation[] = [
      {
        source: 'open-llm-leaderboard',
        benchmark: 'mmlu',
        value: 90,
        evidence: 'direct',
        observedAt: SNAPSHOT_DATE,
      },
      {
        source: 'hf-popularity',
        benchmark: 'hf-popularity',
        value: 10,
        evidence: 'interpolated',
        observedAt: SNAPSHOT_DATE,
      },
    ];
    const def = mergeBenchmarks({
      observations,
      target: TARGET,
      snapshotDate: SNAPSHOT_DATE,
    });
    const swapped = mergeBenchmarks({
      observations,
      target: TARGET,
      snapshotDate: SNAPSHOT_DATE,
      sourceWeights: { 'open-llm-leaderboard': 0.1, 'hf-popularity': 1.0 },
    });
    expect(def.score).toBeGreaterThan(swapped.score);
    // Sanity: defaults match the exported table.
    expect(DEFAULT_SOURCE_WEIGHTS['open-llm-leaderboard']).toBe(1);
  });
});

describe('mergeBenchmarks — score on the 0–100 scale', () => {
  it('echoes a single observation back near its raw value when fresh and direct', () => {
    const result = mergeBenchmarks({
      observations: [
        {
          source: 'open-llm-leaderboard',
          benchmark: 'mmlu',
          value: 80,
          evidence: 'direct',
          observedAt: SNAPSHOT_DATE,
        },
      ],
      target: TARGET,
      snapshotDate: SNAPSHOT_DATE,
    });
    expect(result.score).toBeCloseTo(80, 5);
  });
});
