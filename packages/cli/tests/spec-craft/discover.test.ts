import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { discoverSpecs } from '../../src/spec-craft/extract/discover';

describe('discoverSpecs', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-discover-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeFile(rel: string, content = '# stub'): void {
    const full = path.join(tmpDir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }

  it('returns empty array when no docs/changes or docs/knowledge/decisions exists', () => {
    expect(discoverSpecs(tmpDir)).toEqual([]);
  });

  it('discovers docs/changes/<topic>/proposal.md', () => {
    writeFile('docs/changes/feature-x/proposal.md');
    const specs = discoverSpecs(tmpDir);
    expect(specs).toHaveLength(1);
    expect(specs[0].kind).toBe('proposal');
    expect(specs[0].file).toContain('feature-x/proposal.md');
  });

  it('discovers nested docs/changes/<topic>/<sub>/proposal.md (one level)', () => {
    writeFile('docs/changes/design-pipeline/proposal.md');
    writeFile('docs/changes/design-pipeline/orchestrator/proposal.md');
    const specs = discoverSpecs(tmpDir);
    expect(specs).toHaveLength(2);
  });

  it('discovers docs/knowledge/decisions/*.md', () => {
    writeFile('docs/knowledge/decisions/0001-foo.md');
    writeFile('docs/knowledge/decisions/0002-bar.md');
    const specs = discoverSpecs(tmpDir);
    expect(specs).toHaveLength(2);
    expect(specs.every((s) => s.kind === 'adr')).toBe(true);
  });

  it('excludes README from ADRs', () => {
    writeFile('docs/knowledge/decisions/README.md');
    writeFile('docs/knowledge/decisions/0001-foo.md');
    const specs = discoverSpecs(tmpDir);
    expect(specs).toHaveLength(1);
    expect(specs[0].file).toContain('0001-foo.md');
  });

  it('kinds filter restricts to proposals only', () => {
    writeFile('docs/changes/feature-x/proposal.md');
    writeFile('docs/knowledge/decisions/0001-foo.md');
    const specs = discoverSpecs(tmpDir, ['proposal']);
    expect(specs).toHaveLength(1);
    expect(specs[0].kind).toBe('proposal');
  });

  it('kinds filter restricts to ADRs only', () => {
    writeFile('docs/changes/feature-x/proposal.md');
    writeFile('docs/knowledge/decisions/0001-foo.md');
    const specs = discoverSpecs(tmpDir, ['adr']);
    expect(specs).toHaveLength(1);
    expect(specs[0].kind).toBe('adr');
  });
});
