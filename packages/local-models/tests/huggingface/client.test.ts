import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { HuggingFaceClient, HuggingFaceClientError } from '../../src/huggingface/client.js';
import type { HuggingFaceFetcher, HuggingFaceFetchResponse } from '../../src/huggingface/types.js';

interface RecordedCall {
  url: string;
  headers: Record<string, string>;
}

function makeFetcher(
  responder: (call: RecordedCall) => HuggingFaceFetchResponse | Promise<HuggingFaceFetchResponse>
): {
  fetcher: HuggingFaceFetcher;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const fetcher: HuggingFaceFetcher = async (url, init) => {
    const call: RecordedCall = { url, headers: init?.headers ?? {} };
    calls.push(call);
    return responder(call);
  };
  return { fetcher, calls };
}

function jsonResponse(status: number, body: unknown): HuggingFaceFetchResponse {
  return {
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function textResponse(status: number, body: string): HuggingFaceFetchResponse {
  return {
    status,
    json: async () => {
      throw new Error('not json');
    },
    text: async () => body,
  };
}

async function loadFixture(name: string): Promise<unknown> {
  const url = new URL(`../fixtures/${name}`, import.meta.url);
  const raw = await readFile(fileURLToPath(url), 'utf-8');
  return JSON.parse(raw);
}

describe('HuggingFaceClient', () => {
  it('lists models with sorted query params and a Bearer header when a token is set', async () => {
    const fixture = await loadFixture('hf-list-qwen3.json');
    const { fetcher, calls } = makeFetcher(() => jsonResponse(200, fixture));

    const client = new HuggingFaceClient({ fetcher, token: 'hf_test' });
    const models = await client.listModels({
      search: 'qwen3',
      limit: 5,
      sort: 'downloads',
    });

    expect(models).toHaveLength(2);
    expect(models[0]).toMatchObject({
      id: 'Qwen/Qwen3-32B-GGUF',
      downloads: 184523,
      likes: 412,
      author: 'Qwen',
    });
    expect(models[0]?.tags).toContain('gguf');

    expect(calls).toHaveLength(1);
    const [call] = calls;
    // Params are URL-encoded and sorted alphabetically; the order is part of OT1.
    expect(call?.url).toBe('https://huggingface.co/api/models?limit=5&search=qwen3&sort=downloads');
    expect(call?.headers.Authorization).toBe('Bearer hf_test');
    expect(call?.headers.Accept).toBe('application/json');
  });

  it('omits the Bearer header when no token is configured and HF_TOKEN is unset', async () => {
    const original = process.env.HF_TOKEN;
    delete process.env.HF_TOKEN;
    try {
      const { fetcher, calls } = makeFetcher(() => jsonResponse(200, []));
      const client = new HuggingFaceClient({ fetcher });
      await client.listModels();
      expect(calls[0]?.headers.Authorization).toBeUndefined();
    } finally {
      if (original !== undefined) process.env.HF_TOKEN = original;
    }
  });

  it('reads HF_TOKEN from the environment when no explicit token is passed', async () => {
    const original = process.env.HF_TOKEN;
    process.env.HF_TOKEN = 'hf_env_token';
    try {
      const { fetcher, calls } = makeFetcher(() => jsonResponse(200, []));
      const client = new HuggingFaceClient({ fetcher });
      await client.listModels();
      expect(calls[0]?.headers.Authorization).toBe('Bearer hf_env_token');
    } finally {
      if (original === undefined) delete process.env.HF_TOKEN;
      else process.env.HF_TOKEN = original;
    }
  });

  it('returns parsed model detail with siblings', async () => {
    const fixture = await loadFixture('hf-model-qwen3-32b.json');
    const { fetcher } = makeFetcher(() => jsonResponse(200, fixture));
    const client = new HuggingFaceClient({ fetcher });

    const detail = await client.getModel('Qwen/Qwen3-32B-GGUF');
    expect(detail.id).toBe('Qwen/Qwen3-32B-GGUF');
    expect(detail.siblings.map((s) => s.rfilename)).toEqual([
      'Qwen3-32B-Q4_K_M.gguf',
      'Qwen3-32B-Q5_K_M.gguf',
      'Qwen3-32B-Q8_0.gguf',
      'README.md',
    ]);
  });

  it('maps 404 to HF_NOT_FOUND', async () => {
    const { fetcher } = makeFetcher(() => textResponse(404, 'not found'));
    const client = new HuggingFaceClient({ fetcher });
    await expect(client.getModel('ghost/repo')).rejects.toMatchObject({
      code: 'HF_NOT_FOUND',
      status: 404,
    });
  });

  it('maps 401 and 403 to HF_UNAUTHORIZED', async () => {
    for (const status of [401, 403]) {
      const { fetcher } = makeFetcher(() => textResponse(status, 'denied'));
      const client = new HuggingFaceClient({ fetcher });
      const err = await client.getModel('any/repo').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HuggingFaceClientError);
      expect((err as HuggingFaceClientError).code).toBe('HF_UNAUTHORIZED');
      expect((err as HuggingFaceClientError).status).toBe(status);
    }
  });

  it('maps 429 and 5xx to HF_UNAVAILABLE', async () => {
    for (const status of [429, 500, 502, 503]) {
      const { fetcher } = makeFetcher(() => textResponse(status, 'busy'));
      const client = new HuggingFaceClient({ fetcher });
      const err = await client.getModel('any/repo').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HuggingFaceClientError);
      expect((err as HuggingFaceClientError).code).toBe('HF_UNAVAILABLE');
    }
  });

  it('maps fetcher rejection to HF_NETWORK without leaking the raw error', async () => {
    const fetcher: HuggingFaceFetcher = async () => {
      throw new Error('socket hang up');
    };
    const client = new HuggingFaceClient({ fetcher });
    const err = await client.listModels().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HuggingFaceClientError);
    expect((err as HuggingFaceClientError).code).toBe('HF_NETWORK');
  });

  it('maps non-JSON response bodies to HF_PARSE', async () => {
    const { fetcher } = makeFetcher(() => ({
      status: 200,
      json: async () => {
        throw new Error('not json');
      },
      text: async () => 'plain text',
    }));
    const client = new HuggingFaceClient({ fetcher });
    const err = await client.listModels().catch((e: unknown) => e);
    expect((err as HuggingFaceClientError).code).toBe('HF_PARSE');
  });

  it('maps non-array list bodies to HF_PARSE', async () => {
    const { fetcher } = makeFetcher(() => jsonResponse(200, { error: 'unexpected shape' }));
    const client = new HuggingFaceClient({ fetcher });
    const err = await client.listModels().catch((e: unknown) => e);
    expect((err as HuggingFaceClientError).code).toBe('HF_PARSE');
  });

  it('respects an external abort signal', async () => {
    const fetcher: HuggingFaceFetcher = async (_url, init) =>
      new Promise<HuggingFaceFetchResponse>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted') as Error & { name: string };
          err.name = 'AbortError';
          reject(err);
        });
      });

    const client = new HuggingFaceClient({ fetcher });
    const controller = new AbortController();
    const promise = client.listModels({ signal: controller.signal });
    controller.abort();
    const err = await promise.catch((e: unknown) => e);
    expect((err as HuggingFaceClientError).code).toBe('HF_NETWORK');
  });

  it('derives author from the repo id when HF omits it', async () => {
    const { fetcher } = makeFetcher(() =>
      jsonResponse(200, [
        {
          id: 'mistralai/Mistral-Small-Instruct-2409',
          downloads: 10,
          likes: 1,
          tags: [],
        },
      ])
    );
    const client = new HuggingFaceClient({ fetcher });
    const [model] = await client.listModels();
    expect(model?.author).toBe('mistralai');
  });

  it('returns just the download count from getDownloadCount', async () => {
    const fixture = await loadFixture('hf-model-qwen3-32b.json');
    const { fetcher } = makeFetcher(() => jsonResponse(200, fixture));
    const client = new HuggingFaceClient({ fetcher });
    const downloads = await client.getDownloadCount('Qwen/Qwen3-32B-GGUF');
    expect(downloads).toBe(184523);
  });
});
