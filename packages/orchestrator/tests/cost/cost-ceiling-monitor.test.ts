import { describe, it, expect, vi } from 'vitest';
import type { ModelPricing, TokenUsage } from '@harness-engineering/types';
import { CostCeilingMonitor, computeUsageCostUsd } from '../../src/cost/cost-ceiling-monitor.js';

const PRICING: ModelPricing = {
  inputPer1M: 3.0,
  outputPer1M: 15.0,
  cacheReadPer1M: 0.3,
  cacheWritePer1M: 3.75,
};

function fixedResolver(p: ModelPricing | null): (model: string) => ModelPricing | null {
  return () => p;
}

describe('computeUsageCostUsd', () => {
  it('multiplies tokens by per-1M rates', () => {
    const usage: TokenUsage = {
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      totalTokens: 1_500_000,
    };
    expect(computeUsageCostUsd(usage, PRICING)).toBeCloseTo(3.0 + 7.5);
  });

  it('honours cache read / write rates when present', () => {
    const usage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cacheReadTokens: 1_000_000,
      cacheCreationTokens: 1_000_000,
    };
    expect(computeUsageCostUsd(usage, PRICING)).toBeCloseTo(0.3 + 3.75);
  });

  it('returns 0 when usage is zero', () => {
    expect(computeUsageCostUsd({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }, PRICING)).toBe(
      0
    );
  });
});

describe('CostCeilingMonitor — tasks without ceiling', () => {
  it('never emits abort or warn', () => {
    const monitor = new CostCeilingMonitor({ resolveModelPricing: fixedResolver(PRICING) });
    const onAbort = vi.fn();
    const onWarn = vi.fn();
    monitor.on('abort', onAbort);
    monitor.on('warn', onWarn);
    monitor.registerTask('t1', undefined);
    const cost = monitor.recordTurn(
      't1',
      { inputTokens: 10_000_000, outputTokens: 0, totalTokens: 10_000_000 },
      'claude-sonnet-4'
    );
    expect(cost).toBeGreaterThan(0);
    expect(onAbort).not.toHaveBeenCalled();
    expect(onWarn).not.toHaveBeenCalled();
  });
});

describe('CostCeilingMonitor — ceiling enforcement', () => {
  it('fires abort exactly once when cumulative cost exceeds maxUsd', () => {
    const monitor = new CostCeilingMonitor({ resolveModelPricing: fixedResolver(PRICING) });
    const aborts: unknown[] = [];
    monitor.on('abort', (e) => aborts.push(e));
    // PRICING.inputPer1M = $3/1M; ceiling = $1.00
    monitor.registerTask('t1', { maxUsd: 1.0 });

    // Two turns × 100_000 input tokens = $0.60 cumulative — under the ceiling
    const usage: TokenUsage = { inputTokens: 100_000, outputTokens: 0, totalTokens: 100_000 };
    monitor.recordTurn('t1', usage, 'm');
    monitor.recordTurn('t1', usage, 'm');
    expect(aborts).toHaveLength(0);

    // Big turn pushes cumulative to $1.20 — abort fires
    const big: TokenUsage = { inputTokens: 200_000, outputTokens: 0, totalTokens: 200_000 };
    monitor.recordTurn('t1', big, 'm');
    expect(aborts).toHaveLength(1);
    monitor.recordTurn('t1', big, 'm');
    expect(aborts).toHaveLength(1);
  });

  it('emits warn once at warnAtPct threshold', () => {
    const monitor = new CostCeilingMonitor({ resolveModelPricing: fixedResolver(PRICING) });
    const warns: unknown[] = [];
    monitor.on('warn', (e) => warns.push(e));
    monitor.registerTask('t1', { maxUsd: 1.0, warnAtPct: 50 });
    // 200_000 input × $3/1M = $0.60 — crosses 50% but not 100%
    monitor.recordTurn('t1', { inputTokens: 200_000, outputTokens: 0, totalTokens: 200_000 }, 'm');
    expect(warns).toHaveLength(1);
  });

  it('hasAborted reflects abort state; unregister returns final cost', () => {
    const monitor = new CostCeilingMonitor({ resolveModelPricing: fixedResolver(PRICING) });
    monitor.registerTask('t1', { maxUsd: 0.1 });
    monitor.recordTurn(
      't1',
      { inputTokens: 1_000_000, outputTokens: 0, totalTokens: 1_000_000 },
      'm'
    );
    expect(monitor.hasAborted('t1')).toBe(true);
    const final = monitor.unregisterTask('t1');
    expect(final).toBeCloseTo(3.0);
    expect(monitor.isTracking('t1')).toBe(false);
  });

  it('does not interfere across concurrent tasks', () => {
    const monitor = new CostCeilingMonitor({ resolveModelPricing: fixedResolver(PRICING) });
    monitor.registerTask('a', { maxUsd: 0.01 });
    monitor.registerTask('b', undefined);
    monitor.recordTurn(
      'a',
      { inputTokens: 1_000_000, outputTokens: 0, totalTokens: 1_000_000 },
      'm'
    );
    expect(monitor.hasAborted('a')).toBe(true);
    expect(monitor.hasAborted('b')).toBe(false);
  });

  it('treats missing pricing as zero cost (no false abort)', () => {
    const monitor = new CostCeilingMonitor({ resolveModelPricing: fixedResolver(null) });
    monitor.registerTask('t1', { maxUsd: 0.01 });
    monitor.recordTurn(
      't1',
      { inputTokens: 100_000_000, outputTokens: 0, totalTokens: 100_000_000 },
      'unknown-model'
    );
    expect(monitor.hasAborted('t1')).toBe(false);
    expect(monitor.getCostUsd('t1')).toBe(0);
  });
});
