import { describe, expect, it } from 'vitest';

import { PoolStateStore, type PoolFilesystem } from '../../src/pool/state.js';
import type { PoolEntry, PoolState } from '../../src/pool/types.js';

interface RecordedFsOp {
  op: 'read' | 'write' | 'rename' | 'mkdir';
  path: string;
  contents?: string;
}

function makeFs(initial: Record<string, string> = {}): {
  fs: PoolFilesystem;
  files: Record<string, string>;
  ops: RecordedFsOp[];
} {
  const files: Record<string, string> = { ...initial };
  const ops: RecordedFsOp[] = [];
  const fs: PoolFilesystem = {
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

function entry(overrides: Partial<PoolEntry> = {}): PoolEntry {
  return {
    ollamaName: 'qwen3:32b',
    hfRepoId: 'Qwen/Qwen3-32B-GGUF',
    sizeOnDiskGb: 18,
    installedAt: '2026-05-29T12:00:00.000Z',
    lastUsedAt: null,
    currentScore: 75,
    ...overrides,
  };
}

describe('PoolStateStore', () => {
  it('returns the empty state on a missing file with no warning', async () => {
    const warnings: string[] = [];
    const { fs, ops } = makeFs();
    const store = new PoolStateStore({
      path: '/tmp/pool.json',
      fs,
      onWarn: (m) => warnings.push(m),
    });
    await store.load();

    const state = store.snapshot();
    expect(state.entries).toEqual([]);
    expect(state.diskBudgetGb).toBe(0);
    expect(state.diskUsedGb).toBe(0);
    expect(state.allowedOrgs).toEqual([]);
    expect(state.allowedFamilies).toEqual([]);
    expect(state.lastRefreshAt).toBeNull();
    expect(warnings).toEqual([]);
    expect(ops.filter((o) => o.op !== 'read')).toEqual([]);
  });

  it('persists atomically via tmp + rename and round-trips', async () => {
    const { fs, files, ops } = makeFs();
    const store = new PoolStateStore({ path: '/var/state/pool.json', fs });
    await store.load();
    store.update((s) => ({
      ...s,
      diskBudgetGb: 100,
      entries: [entry({ ollamaName: 'qwen3:32b', sizeOnDiskGb: 18 })],
      allowedOrgs: ['Qwen'],
    }));
    await store.persist();

    expect(ops.map((o) => o.op)).toEqual(['read', 'mkdir', 'write', 'rename']);
    const writeOp = ops.find((o) => o.op === 'write');
    expect(writeOp?.path).toBe('/var/state/pool.json.tmp');
    const renameOp = ops.find((o) => o.op === 'rename');
    expect(renameOp?.path).toBe('/var/state/pool.json.tmp->/var/state/pool.json');

    const persisted = JSON.parse(files['/var/state/pool.json'] as string);
    expect(persisted.version).toBe(1);
    expect(persisted.state.diskBudgetGb).toBe(100);
    expect(persisted.state.diskUsedGb).toBe(18);
    expect(persisted.state.entries[0].ollamaName).toBe('qwen3:32b');
    expect(persisted.state.allowedOrgs).toEqual(['Qwen']);
  });

  it('hydrates a previously persisted file and re-derives diskUsedGb', async () => {
    const persisted = JSON.stringify({
      version: 1,
      state: {
        diskBudgetGb: 100,
        diskUsedGb: 999, // intentionally bogus; should be recomputed on update
        entries: [entry({ ollamaName: 'qwen3:14b', sizeOnDiskGb: 8 })],
        allowedOrgs: ['Qwen'],
        allowedFamilies: [],
        lastRefreshAt: '2026-05-29T11:00:00.000Z',
      } satisfies PoolState,
    });
    const { fs } = makeFs({ '/tmp/pool.json': persisted });
    const store = new PoolStateStore({ path: '/tmp/pool.json', fs });
    await store.load();

    const snapshot = store.snapshot();
    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0]?.ollamaName).toBe('qwen3:14b');
    expect(snapshot.allowedOrgs).toEqual(['Qwen']);

    store.update((s) => s);
    expect(store.snapshot().diskUsedGb).toBe(8);
  });

  it('always recomputes diskUsedGb on update, ignoring caller assignments', async () => {
    const { fs } = makeFs();
    const store = new PoolStateStore({ path: '/tmp/pool.json', fs });
    await store.load();
    store.update((s) => ({
      ...s,
      diskUsedGb: 999,
      entries: [
        entry({ ollamaName: 'a', sizeOnDiskGb: 3 }),
        entry({ ollamaName: 'b', sizeOnDiskGb: 7 }),
      ],
    }));
    expect(store.snapshot().diskUsedGb).toBe(10);
  });

  it('snapshot() returns an isolated clone — mutating it cannot leak back', async () => {
    const { fs } = makeFs();
    const store = new PoolStateStore({ path: '/tmp/pool.json', fs });
    await store.load();
    store.update((s) => ({ ...s, entries: [entry({ ollamaName: 'pinned' })] }));

    const snap = store.snapshot();
    snap.entries.push(entry({ ollamaName: 'leaked' }));
    snap.allowedOrgs.push('leaked-org');

    const fresh = store.snapshot();
    expect(fresh.entries.map((e) => e.ollamaName)).toEqual(['pinned']);
    expect(fresh.allowedOrgs).toEqual([]);
  });

  it('treats malformed JSON as empty and emits a warning', async () => {
    const warnings: string[] = [];
    const { fs } = makeFs({ '/tmp/pool.json': '{not json' });
    const store = new PoolStateStore({
      path: '/tmp/pool.json',
      fs,
      onWarn: (m) => warnings.push(m),
    });
    await store.load();
    expect(store.snapshot().entries).toEqual([]);
    expect(warnings.some((w) => w.includes('not valid JSON'))).toBe(true);
  });

  it('treats a schema version mismatch as empty and emits a warning', async () => {
    const warnings: string[] = [];
    const future = JSON.stringify({
      version: 99,
      state: {
        diskBudgetGb: 0,
        diskUsedGb: 0,
        entries: [],
        allowedOrgs: [],
        allowedFamilies: [],
        lastRefreshAt: null,
      },
    });
    const { fs } = makeFs({ '/tmp/pool.json': future });
    const store = new PoolStateStore({
      path: '/tmp/pool.json',
      fs,
      onWarn: (m) => warnings.push(m),
    });
    await store.load();
    expect(store.snapshot().entries).toEqual([]);
    expect(warnings.some((w) => w.includes('schema version'))).toBe(true);
  });

  it('treats a shape mismatch as empty and emits a warning', async () => {
    const warnings: string[] = [];
    const malformed = JSON.stringify({
      version: 1,
      state: { entries: 'not an array' },
    });
    const { fs } = makeFs({ '/tmp/pool.json': malformed });
    const store = new PoolStateStore({
      path: '/tmp/pool.json',
      fs,
      onWarn: (m) => warnings.push(m),
    });
    await store.load();
    expect(store.snapshot().entries).toEqual([]);
    expect(warnings.some((w) => w.includes('unexpected shape'))).toBe(true);
  });

  it('tolerates a non-ENOENT read error and emits a warning', async () => {
    const warnings: string[] = [];
    const fs: PoolFilesystem = {
      readFile: async () => {
        throw new Error('EPERM denied');
      },
      writeFile: async () => undefined,
      rename: async () => undefined,
      mkdir: async () => undefined,
    };
    const store = new PoolStateStore({
      path: '/tmp/pool.json',
      fs,
      onWarn: (m) => warnings.push(m),
    });
    await store.load();
    expect(store.snapshot().entries).toEqual([]);
    expect(warnings.some((w) => w.includes('pool state read failed'))).toBe(true);
  });

  it('load() is idempotent — repeated calls do not re-read disk', async () => {
    const { fs, ops } = makeFs();
    const store = new PoolStateStore({ path: '/tmp/pool.json', fs });
    await store.load();
    await store.load();
    await store.load();
    expect(ops.filter((o) => o.op === 'read')).toHaveLength(1);
  });
});
