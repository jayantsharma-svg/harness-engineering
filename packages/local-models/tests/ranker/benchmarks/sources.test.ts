import { describe, expect, it } from 'vitest';

import {
  HF_POPULARITY_URL,
  LIKE_WEIGHT,
  OPEN_LLM_LEADERBOARD_URL,
  type Fetcher,
  type FetcherResponse,
  huggingFacePopularitySource,
  openLlmLeaderboardSource,
} from '../../../src/ranker/benchmarks/sources.js';

const NOW = () => new Date('2026-05-29T00:00:00.000Z');
const FETCHED_AT = '2026-05-29';

/** Factory for a stub fetcher returning a static JSON payload with ok=true. */
function jsonFetcher(payload: unknown, status = 200): Fetcher {
  return async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    }) satisfies FetcherResponse;
}

/** Factory: returns a fetcher whose call rejects with a network error. */
function rejectingFetcher(message: string): Fetcher {
  return async () => {
    throw new Error(message);
  };
}

/** Factory: ok response but json() rejects. */
function badJsonFetcher(): Fetcher {
  return async () =>
    ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('boom');
      },
      text: async () => 'not json',
    }) satisfies FetcherResponse;
}

describe('openLlmLeaderboardSource — happy path (OT5)', () => {
  it('emits direct observations across every (model, benchmark) pair', async () => {
    const payload = {
      models: [
        { model: 'Qwen/Qwen3-32B-GGUF', scores: { arc: 78.5, mmlu: 81.2 } },
        { model: 'meta-llama/Llama-3-70B', scores: { mmlu: 84.0 } },
      ],
    };
    const result = await openLlmLeaderboardSource.fetch({
      fetcher: jsonFetcher(payload),
      now: NOW,
    });
    expect(result.source).toBe('open-llm-leaderboard');
    expect(result.fetchedAt).toBe(FETCHED_AT);
    expect(result.warnings).toEqual([]);
    expect(result.observations).toHaveLength(3);
    for (const obs of result.observations) {
      expect(obs.source).toBe('open-llm-leaderboard');
      expect(obs.evidence).toBe('direct');
      expect(obs.observedAt).toBe(FETCHED_AT);
    }
    const benchmarks = result.observations.map((o) => o.benchmark).sort();
    expect(benchmarks).toEqual(['arc', 'mmlu', 'mmlu']);
  });

  it('exposes its URL constant so the wiring layer can re-target it', () => {
    expect(OPEN_LLM_LEADERBOARD_URL).toContain('open-llm-leaderboard');
  });
});

describe('openLlmLeaderboardSource — degraded paths (OT5)', () => {
  it('surfaces fetch_failed when the HTTP response is non-2xx', async () => {
    const result = await openLlmLeaderboardSource.fetch({
      fetcher: jsonFetcher({}, 503),
      now: NOW,
    });
    expect(result.observations).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.code).toBe('fetch_failed');
  });

  it('surfaces fetch_failed when the fetcher rejects', async () => {
    const result = await openLlmLeaderboardSource.fetch({
      fetcher: rejectingFetcher('econnreset'),
      now: NOW,
    });
    expect(result.warnings[0]?.code).toBe('fetch_failed');
    expect(result.warnings[0]?.cause).toContain('econnreset');
  });

  it('surfaces parse_failed when json() rejects', async () => {
    const result = await openLlmLeaderboardSource.fetch({
      fetcher: badJsonFetcher(),
      now: NOW,
    });
    expect(result.warnings[0]?.code).toBe('parse_failed');
  });

  it('surfaces schema_invalid when the payload is the wrong shape', async () => {
    const result = await openLlmLeaderboardSource.fetch({
      fetcher: jsonFetcher({ junk: true }),
      now: NOW,
    });
    expect(result.warnings[0]?.code).toBe('schema_invalid');
    expect(result.observations).toEqual([]);
  });

  it('surfaces schema_invalid per model when scores object is empty', async () => {
    // Empty `scores: {}` passes the structural guard vacuously. Without a
    // per-model warning the operator can't tell "API returned an empty
    // model row" from "model was rebuilt with zero benchmarks today".
    const payload = {
      models: [
        { model: 'Qwen/Qwen3-32B-GGUF', scores: {} },
        { model: 'meta-llama/Llama-3-70B', scores: { mmlu: 84.0 } },
      ],
    };
    const result = await openLlmLeaderboardSource.fetch({
      fetcher: jsonFetcher(payload),
      now: NOW,
    });
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0]?.benchmark).toBe('mmlu');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.code).toBe('schema_invalid');
    expect(result.warnings[0]?.message).toContain('Qwen/Qwen3-32B-GGUF');
  });
});

describe('huggingFacePopularitySource — happy path (OT6)', () => {
  it('emits one observation per model with monotonic values in downloads+likes order', async () => {
    const payload = [
      { id: 'a/low', downloads: 100, likes: 1 },
      { id: 'b/mid', downloads: 1000, likes: 10 },
      { id: 'c/high', downloads: 10000, likes: 100 },
    ];
    const result = await huggingFacePopularitySource.fetch({
      fetcher: jsonFetcher(payload),
      now: NOW,
    });
    expect(result.warnings).toEqual([]);
    expect(result.observations).toHaveLength(3);

    for (const obs of result.observations) {
      expect(obs.source).toBe('hf-popularity');
      expect(obs.benchmark).toBe('hf-popularity');
      expect(obs.evidence).toBe('interpolated');
    }

    // Composite values track downloads + likes * LIKE_WEIGHT.
    const composites = payload.map((p) => p.downloads + p.likes * LIKE_WEIGHT);
    const expectedValues = composites.map((c) => (c / composites[2]!) * 100);
    const actualValues = result.observations.map((o) => o.value);

    for (let i = 0; i < expectedValues.length; i++) {
      expect(actualValues[i]!).toBeCloseTo(expectedValues[i]!, 6);
    }
    expect(actualValues[0]!).toBeLessThan(actualValues[1]!);
    expect(actualValues[1]!).toBeLessThan(actualValues[2]!);
    expect(actualValues[2]!).toBeCloseTo(100, 6);
  });

  it('surfaces schema_invalid and emits nothing when every entry has zero downloads/likes', async () => {
    // Emitting zero-value observations would silently dilute parallel-source
    // contributions in the merge. The adapter degrades to a warning instead.
    const result = await huggingFacePopularitySource.fetch({
      fetcher: jsonFetcher([{ id: 'a/zero', downloads: 0, likes: 0 }]),
      now: NOW,
    });
    expect(result.observations).toEqual([]);
    expect(result.warnings[0]?.code).toBe('schema_invalid');
  });

  it('exposes its URL constant', () => {
    expect(HF_POPULARITY_URL).toContain('huggingface.co/api/models');
  });
});

describe('huggingFacePopularitySource — degraded paths', () => {
  it('returns warnings and no observations when the schema is wrong', async () => {
    const result = await huggingFacePopularitySource.fetch({
      fetcher: jsonFetcher({ models: 'not an array' }),
      now: NOW,
    });
    expect(result.observations).toEqual([]);
    expect(result.warnings[0]?.code).toBe('schema_invalid');
  });
});
