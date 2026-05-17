import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ContextResolver, type InlineSkillReader } from '../../src/maintenance/context-resolver';
import { TaskOutputStore } from '../../src/maintenance/output-store';
import type { PersistedOutputEntry } from '../../src/maintenance/output-store';

function makeEntry(
  taskId: string,
  overrides: Partial<PersistedOutputEntry> = {}
): PersistedOutputEntry {
  return {
    taskId,
    startedAt: '2026-05-17T14:00:00.000Z',
    completedAt: '2026-05-17T14:00:00.000Z',
    status: 'success',
    findings: 0,
    fixed: 0,
    prUrl: null,
    prUpdated: false,
    origin: 'cron',
    ...overrides,
  };
}

describe('ContextResolver.resolveContextFrom', () => {
  let rootDir: string;
  let store: TaskOutputStore;
  let resolver: ContextResolver;

  beforeEach(async () => {
    rootDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'context-resolver-'));
    store = new TaskOutputStore({ rootDir });
    resolver = new ContextResolver({ outputStore: store });
  });

  afterEach(async () => {
    await fs.promises.rm(rootDir, { recursive: true, force: true });
  });

  it('returns empty string when there are no upstream IDs', async () => {
    expect(await resolver.resolveContextFrom(undefined)).toBe('');
    expect(await resolver.resolveContextFrom([])).toBe('');
  });

  it('emits a no-prior-run marker when upstream has no entries', async () => {
    const out = await resolver.resolveContextFrom(['ghost']);
    expect(out).toContain('### ghost');
    expect(out).toContain('[no prior run]');
  });

  it('formats a fresh upstream with status + findings + stdout', async () => {
    const recent = new Date().toISOString();
    await store.write(
      'upstream',
      makeEntry('upstream', { completedAt: recent, findings: 3, stdout: 'hello world' })
    );
    const out = await resolver.resolveContextFrom(['upstream']);
    expect(out).toContain('## Upstream context');
    expect(out).toContain('findings=3');
    expect(out).toContain('hello world');
  });

  it('marks a stale upstream when older than maxAgeMinutes', async () => {
    const old = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    await store.write(
      'stale',
      makeEntry('stale', { completedAt: old, stdout: 'should not appear' })
    );
    const out = await resolver.resolveContextFrom(['stale'], { maxAgeMinutes: 60 });
    expect(out).toContain('stale: omitted');
    expect(out).not.toContain('should not appear');
  });

  it('truncates very long stdout', async () => {
    const small = new ContextResolver({ outputStore: store, perUpstreamMaxChars: 20 });
    await store.write(
      'big',
      makeEntry('big', { completedAt: new Date().toISOString(), stdout: 'x'.repeat(500) })
    );
    const out = await small.resolveContextFrom(['big']);
    expect(out).toContain('[truncated]');
  });
});

describe('ContextResolver.resolveInlineSkills', () => {
  it('returns empty string when skillReader is absent', async () => {
    const store = new TaskOutputStore({ rootDir: '/tmp' });
    const r = new ContextResolver({ outputStore: store });
    expect(await r.resolveInlineSkills(['a'])).toBe('');
  });

  it('inlines skills under their bodies', async () => {
    const reader: InlineSkillReader = {
      read: async (n) => (n === 'k' ? '# Skill K\n\nDo K things' : null),
    };
    const store = new TaskOutputStore({ rootDir: '/tmp' });
    const r = new ContextResolver({ outputStore: store, skillReader: reader });
    const out = await r.resolveInlineSkills(['k']);
    expect(out).toContain('## Reference skills');
    expect(out).toContain('### k');
    expect(out).toContain('Do K things');
  });

  it('truncates skill-granularly on budget exhaustion', async () => {
    const big = 'x'.repeat(2000);
    const reader: InlineSkillReader = { read: async () => big };
    const store = new TaskOutputStore({ rootDir: '/tmp' });
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const r = new ContextResolver({ outputStore: store, skillReader: reader, logger });
    // Budget 100 tokens ~= 400 chars; first skill (2000 chars) overflows
    const out = await r.resolveInlineSkills(['a', 'b'], 100);
    expect(out).toBe('');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('inlineSkillsBudgetTokens (100) exhausted')
    );
  });

  it('skips missing skills with a warning rather than failing', async () => {
    const reader: InlineSkillReader = {
      read: async (n) => (n === 'known' ? 'present body' : null),
    };
    const store = new TaskOutputStore({ rootDir: '/tmp' });
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const r = new ContextResolver({ outputStore: store, skillReader: reader, logger });
    const out = await r.resolveInlineSkills(['missing', 'known']);
    expect(out).toContain('### known');
    expect(out).not.toContain('### missing');
    expect(logger.warn).toHaveBeenCalled();
  });
});
