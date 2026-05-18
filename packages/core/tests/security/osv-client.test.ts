import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createOsvClient } from '../../src/security/osv-client';

function makeFetchOk(vulns: Array<{ id: string; summary?: string }>): typeof fetch {
  return (async (_url: string, _init?: unknown) => {
    return {
      ok: true,
      status: 200,
      json: async () => ({ vulns }),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe('OsvClient', () => {
  let cacheDir: string;

  beforeEach(async () => {
    cacheDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'osv-client-'));
  });

  afterEach(async () => {
    await fs.promises.rm(cacheDir, { recursive: true, force: true });
  });

  it('returns empty arrays when OSV reports no vulnerabilities', async () => {
    const client = createOsvClient({ cacheDir, fetchFn: makeFetchOk([]) });
    const result = await client.check({ ecosystem: 'npm', name: 'lodash', version: '4.17.21' });
    expect(result.malicious).toEqual([]);
    expect(result.other).toEqual([]);
    expect(result.source).toBe('network');
  });

  it('classifies MAL-* advisories as malicious', async () => {
    const fetchFn = makeFetchOk([
      { id: 'MAL-2026-0042', summary: 'malicious package' },
      { id: 'GHSA-xxxx', summary: 'regular vuln' },
    ]);
    const client = createOsvClient({ cacheDir, fetchFn });
    const result = await client.check({ ecosystem: 'npm', name: 'bad-pkg' });
    expect(result.malicious.length).toBe(1);
    expect(result.malicious[0]?.id).toBe('MAL-2026-0042');
    expect(result.other.length).toBe(1);
    expect(result.other[0]?.id).toBe('GHSA-xxxx');
  });

  it('returns cached results on warm fetch within TTL', async () => {
    const fetchFn = vi.fn(makeFetchOk([{ id: 'MAL-2026-0001', summary: 's' }]));
    const client = createOsvClient({ cacheDir, fetchFn: fetchFn as unknown as typeof fetch });
    const first = await client.check({ ecosystem: 'npm', name: 'pkg', version: '1.0.0' });
    expect(first.source).toBe('network');
    const second = await client.check({ ecosystem: 'npm', name: 'pkg', version: '1.0.0' });
    expect(second.source).toBe('cache');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('fails open on network errors when strict=false', async () => {
    const fetchFn = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const logger = { warn: vi.fn() };
    const client = createOsvClient({ cacheDir, fetchFn, logger });
    const result = await client.check({ ecosystem: 'npm', name: 'pkg' });
    expect(result.source).toBe('fail-open');
    expect(result.malicious).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('fails closed on network errors when strict=true', async () => {
    const fetchFn = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const client = createOsvClient({ cacheDir, fetchFn, strict: true });
    await expect(client.check({ ecosystem: 'npm', name: 'pkg' })).rejects.toThrow(
      'OSV query failed'
    );
  });

  it('treats HTTP non-2xx as a network error (fail-open)', async () => {
    const fetchFn = (async () =>
      ({
        ok: false,
        status: 500,
        json: async () => ({}),
      }) as unknown as Response) as unknown as typeof fetch;
    const client = createOsvClient({ cacheDir, fetchFn, logger: { warn: () => {} } });
    const result = await client.check({ ecosystem: 'npm', name: 'pkg' });
    expect(result.source).toBe('fail-open');
  });

  it('clearCache removes cached entries', async () => {
    const fetchFn = vi.fn(makeFetchOk([]));
    const client = createOsvClient({ cacheDir, fetchFn: fetchFn as unknown as typeof fetch });
    await client.check({ ecosystem: 'npm', name: 'pkg', version: '1' });
    expect(await fs.promises.readdir(cacheDir)).not.toHaveLength(0);
    await client.clearCache();
    expect(fs.existsSync(cacheDir)).toBe(false);
  });

  it('uses sanitized cache filenames for scoped packages', async () => {
    const client = createOsvClient({ cacheDir, fetchFn: makeFetchOk([]) });
    await client.check({ ecosystem: 'npm', name: '@scope/pkg', version: '1' });
    const files = await fs.promises.readdir(cacheDir);
    expect(files.some((f) => f.includes('@scope__pkg'))).toBe(true);
  });
});
