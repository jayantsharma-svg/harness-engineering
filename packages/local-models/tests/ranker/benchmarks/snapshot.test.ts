import { describe, expect, it } from 'vitest';

import { loadFrozenSnapshot } from '../../../src/ranker/benchmarks/snapshot.js';

describe('loadFrozenSnapshot', () => {
  it('loads the bundled snapshot with source = "frozen"', async () => {
    const result = await loadFrozenSnapshot();
    expect(result.source).toBe('frozen');
    expect(result.warnings).toEqual([]);
    expect(result.snapshot.version).toBe(1);
    expect(result.snapshot.source).toBe('seed');
    expect(result.snapshot.models.length).toBeGreaterThan(0);

    // Spot-check a known seed entry.
    const qwen = result.snapshot.models.find((m) => m.hfRepoId === 'Qwen/Qwen3-32B-GGUF');
    expect(qwen).toBeDefined();
    expect(qwen?.family).toBe('qwen3');
    expect(qwen?.observations[0]?.benchmark).toBe('mmlu-pro');
  });

  it('falls back when the override fails schema validation (root not object)', async () => {
    const result = await loadFrozenSnapshot({
      override: 'not an object',
      now: () => new Date('2026-05-28T00:00:00.000Z'),
    });
    expect(result.source).toBe('fallback');
    expect(result.snapshot.models).toEqual([]);
    expect(result.snapshot.generatedAt).toBe('2026-05-28');
    expect(result.warnings[0]?.code).toBe('snapshot_schema_invalid');
  });

  it('falls back on unsupported version', async () => {
    const result = await loadFrozenSnapshot({
      override: { version: 99, generatedAt: '2026-01-01', source: 'snapshot', models: [] },
      now: () => new Date('2026-05-28T00:00:00.000Z'),
    });
    expect(result.source).toBe('fallback');
    expect(result.warnings[0]?.message).toMatch(/unsupported version/);
  });

  it('falls back when models is not an array', async () => {
    const result = await loadFrozenSnapshot({
      override: { version: 1, generatedAt: '2026-01-01', source: 'snapshot', models: 'oops' },
      now: () => new Date('2026-05-28T00:00:00.000Z'),
    });
    expect(result.source).toBe('fallback');
    expect(result.warnings[0]?.reason ?? result.warnings[0]?.message).toMatch(
      /models is not an array/
    );
  });

  it('falls back when an observation has an unknown evidence grade', async () => {
    const result = await loadFrozenSnapshot({
      override: {
        version: 1,
        generatedAt: '2026-01-01',
        source: 'snapshot',
        models: [
          {
            hfRepoId: 'fake/repo',
            family: 'fake',
            sizeB: 7,
            observations: [
              {
                source: 'fake-source',
                benchmark: 'fake-bench',
                value: 50,
                evidence: 'made-up-grade',
                observedAt: '2026-01-01',
              },
            ],
          },
        ],
      },
      now: () => new Date('2026-05-28T00:00:00.000Z'),
    });
    expect(result.source).toBe('fallback');
    expect(result.warnings[0]?.message).toMatch(/not a known grade/);
  });

  it('accepts a snapshot with empty models array', async () => {
    const result = await loadFrozenSnapshot({
      override: { version: 1, generatedAt: '2026-04-01', source: 'snapshot', models: [] },
    });
    expect(result.source).toBe('frozen');
    expect(result.snapshot.models).toEqual([]);
    expect(result.snapshot.generatedAt).toBe('2026-04-01');
  });
});
