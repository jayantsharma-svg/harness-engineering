import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { discoverKnowledgeEntries } from '../../src/knowledge-craft/extract/discover';

describe('discoverKnowledgeEntries', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-discover-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeFile(rel: string, content = '# stub'): void {
    const full = path.join(tmpDir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }

  it('returns empty array when docs/knowledge/ does not exist', () => {
    expect(discoverKnowledgeEntries(tmpDir)).toEqual([]);
  });

  it('discovers .md entries directly under docs/knowledge/', () => {
    writeFile('docs/knowledge/auth-roles.md');
    writeFile('docs/knowledge/billing-rules.md');
    const entries = discoverKnowledgeEntries(tmpDir);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.relative).sort()).toEqual(['auth-roles.md', 'billing-rules.md']);
  });

  it('walks subdirectories recursively', () => {
    writeFile('docs/knowledge/design/component-anatomy.md');
    writeFile('docs/knowledge/business/tenant-isolation.md');
    const entries = discoverKnowledgeEntries(tmpDir);
    expect(entries).toHaveLength(2);
    // relative paths normalized to POSIX separators
    const relatives = entries.map((e) => e.relative).sort();
    expect(relatives).toEqual(['business/tenant-isolation.md', 'design/component-anatomy.md']);
  });

  it('EXCLUDES docs/knowledge/decisions/ subdir entirely (spec-craft territory)', () => {
    writeFile('docs/knowledge/decisions/0001-foo.md');
    writeFile('docs/knowledge/decisions/0002-bar.md');
    writeFile('docs/knowledge/regular-entry.md');
    const entries = discoverKnowledgeEntries(tmpDir);
    expect(entries).toHaveLength(1);
    expect(entries[0].relative).toBe('regular-entry.md');
  });

  it('excludes README.md files (case-insensitive)', () => {
    writeFile('docs/knowledge/README.md');
    writeFile('docs/knowledge/design/readme.md');
    writeFile('docs/knowledge/design/component.md');
    const entries = discoverKnowledgeEntries(tmpDir);
    expect(entries).toHaveLength(1);
    expect(entries[0].relative).toBe('design/component.md');
  });

  it('honors extraExcludeDirs argument', () => {
    writeFile('docs/knowledge/drafts/wip.md');
    writeFile('docs/knowledge/auth.md');
    const entries = discoverKnowledgeEntries(tmpDir, ['drafts']);
    expect(entries).toHaveLength(1);
    expect(entries[0].relative).toBe('auth.md');
  });

  it('excludes hidden dotfile dirs and files', () => {
    writeFile('docs/knowledge/.cache/junk.md');
    writeFile('docs/knowledge/.hidden.md');
    writeFile('docs/knowledge/visible.md');
    const entries = discoverKnowledgeEntries(tmpDir);
    expect(entries).toHaveLength(1);
    expect(entries[0].relative).toBe('visible.md');
  });

  it('ignores non-markdown files', () => {
    writeFile('docs/knowledge/data.json');
    writeFile('docs/knowledge/notes.txt');
    writeFile('docs/knowledge/real.md');
    const entries = discoverKnowledgeEntries(tmpDir);
    expect(entries).toHaveLength(1);
    expect(entries[0].relative).toBe('real.md');
  });
});
