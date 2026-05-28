import { describe, expect, it } from 'vitest';

import { HuggingFaceCache, type CacheFilesystem } from '../../src/huggingface/cache.js';

interface RecordedFsOp {
  op: 'read' | 'write' | 'rename' | 'mkdir';
  path: string;
  contents?: string;
}

function makeFs(initial: Record<string, string> = {}): {
  fs: CacheFilesystem;
  files: Record<string, string>;
  ops: RecordedFsOp[];
} {
  const files: Record<string, string> = { ...initial };
  const ops: RecordedFsOp[] = [];
  const fs: CacheFilesystem = {
    async readFile(path) {
      ops.push({ op: 'read', path });
      if (path in files) return files[path] as string;
      const err = new Error(`ENOENT: ${path}`) as Error & { code: string };
      err.code = 'ENOENT';
      throw err;
    },
    async writeFile(path, contents) {
      ops.push({ op: 'write', path, contents });
      files[path] = contents;
    },
    async rename(from, to) {
      ops.push({ op: 'rename', path: `${from}->${to}` });
      if (!(from in files)) throw new Error(`source missing: ${from}`);
      files[to] = files[from] as string;
      delete files[from];
    },
    async mkdir(path) {
      ops.push({ op: 'mkdir', path });
    },
  };
  return { fs, files, ops };
}

describe('HuggingFaceCache', () => {
  it('returns undefined on a missing key', async () => {
    const { fs } = makeFs();
    const cache = new HuggingFaceCache({ path: '/tmp/cache.json', fs });
    await cache.load();
    expect(cache.get('missing')).toBeUndefined();
  });

  it('returns the value for a fresh key and undefined once the TTL elapses', async () => {
    let now = 1000;
    const { fs } = makeFs();
    const cache = new HuggingFaceCache({
      path: '/tmp/cache.json',
      ttlMs: 100,
      now: () => now,
      fs,
    });
    await cache.load();
    cache.set('foo', { hello: 'world' });

    now = 1050;
    expect(cache.get<{ hello: string }>('foo')).toEqual({ hello: 'world' });

    now = 1099;
    expect(cache.get('foo')).toEqual({ hello: 'world' });

    // TTL boundary is inclusive of staleness (age === ttlMs ⇒ stale)
    now = 1100;
    expect(cache.get('foo')).toBeUndefined();
  });

  it('persists atomically via tmp + rename', async () => {
    const { fs, files, ops } = makeFs();
    const cache = new HuggingFaceCache({
      path: '/var/cache/huggingface.json',
      now: () => 5_000,
      fs,
    });
    await cache.load();
    cache.set('alpha', { value: 1 });
    cache.set('beta', { value: 2 });
    await cache.persist();

    expect(ops.map((o) => o.op)).toEqual(['read', 'mkdir', 'write', 'rename']);
    const writeOp = ops.find((o) => o.op === 'write');
    expect(writeOp?.path).toBe('/var/cache/huggingface.json.tmp');
    const renameOp = ops.find((o) => o.op === 'rename');
    expect(renameOp?.path).toBe('/var/cache/huggingface.json.tmp->/var/cache/huggingface.json');

    expect(files['/var/cache/huggingface.json']).toBeTruthy();
    const persisted = JSON.parse(files['/var/cache/huggingface.json'] as string);
    expect(persisted.version).toBe(1);
    expect(persisted.entries.alpha.value).toEqual({ value: 1 });
    expect(persisted.entries.beta.storedAt).toBe(5_000);
  });

  it('hydrates from a previously persisted file', async () => {
    const persisted = JSON.stringify({
      version: 1,
      entries: {
        cached: { storedAt: 10_000, value: { hi: 'there' } },
      },
    });
    const { fs } = makeFs({ '/tmp/cache.json': persisted });
    const cache = new HuggingFaceCache({
      path: '/tmp/cache.json',
      ttlMs: 5_000,
      now: () => 12_000,
      fs,
    });
    await cache.load();
    expect(cache.get<{ hi: string }>('cached')).toEqual({ hi: 'there' });
  });

  it('treats a malformed JSON file as empty and emits a warning', async () => {
    const warnings: string[] = [];
    const { fs } = makeFs({ '/tmp/cache.json': '{not json' });
    const cache = new HuggingFaceCache({
      path: '/tmp/cache.json',
      fs,
      onWarn: (msg) => warnings.push(msg),
    });
    await cache.load();
    expect(cache.get('anything')).toBeUndefined();
    expect(warnings.some((w) => w.includes('not valid JSON'))).toBe(true);
  });

  it('treats a schema version mismatch as empty and emits a warning', async () => {
    const warnings: string[] = [];
    const { fs } = makeFs({
      '/tmp/cache.json': JSON.stringify({ version: 99, entries: {} }),
    });
    const cache = new HuggingFaceCache({
      path: '/tmp/cache.json',
      fs,
      onWarn: (msg) => warnings.push(msg),
    });
    await cache.load();
    expect(cache.get('anything')).toBeUndefined();
    expect(warnings.some((w) => w.includes('schema version mismatch'))).toBe(true);
  });

  it('tolerates an underlying read error other than ENOENT and emits a warning', async () => {
    const warnings: string[] = [];
    const fs: CacheFilesystem = {
      readFile: async () => {
        throw new Error('EPERM denied');
      },
      writeFile: async () => undefined,
      rename: async () => undefined,
      mkdir: async () => undefined,
    };
    const cache = new HuggingFaceCache({
      path: '/tmp/cache.json',
      fs,
      onWarn: (msg) => warnings.push(msg),
    });
    await cache.load();
    expect(cache.get('anything')).toBeUndefined();
    expect(warnings.some((w) => w.includes('cache read failed'))).toBe(true);
  });

  it('clear() removes all entries', async () => {
    const { fs } = makeFs();
    const cache = new HuggingFaceCache({ path: '/tmp/cache.json', fs });
    await cache.load();
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.snapshot()).toEqual({});
  });

  it('load() is idempotent — repeated calls do not re-read the disk', async () => {
    const { fs, ops } = makeFs();
    const cache = new HuggingFaceCache({ path: '/tmp/cache.json', fs });
    await cache.load();
    await cache.load();
    await cache.load();
    expect(ops.filter((o) => o.op === 'read')).toHaveLength(1);
  });
});
