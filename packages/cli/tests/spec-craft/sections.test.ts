import { describe, it, expect } from 'vitest';
import { parseSections, canonicalize } from '../../src/spec-craft/extract/sections';

describe('parseSections', () => {
  it('splits markdown by H2 headings into sections', () => {
    const md = `# Title\n\n## Overview\n\nbody1\n\n## Decisions\n\nbody2\n`;
    const sections = parseSections(md);
    expect(sections).toHaveLength(2);
    expect(sections[0].heading).toBe('Overview');
    expect(sections[1].heading).toBe('Decisions');
  });

  it('canonicalizes section names', () => {
    const md = `## Decisions\n\nfoo\n\n## Out-of-scope (v1)\n\nbar\n`;
    const sections = parseSections(md);
    expect(sections[0].canonical).toBe('decisions');
    expect(sections[1].canonical).toBe('out-of-scope-v1');
  });

  it('captures correct line numbers (1-indexed)', () => {
    const md = `# Title\n\n## Overview\nfirst body line\n\n## Decisions\nanother\n`;
    const sections = parseSections(md);
    // H2 is on line 3, body starts line 4
    expect(sections[0].line).toBe(4);
    // H2 is on line 6, body starts line 7
    expect(sections[1].line).toBe(7);
  });

  it('keeps H3 subsections as part of parent H2 body', () => {
    const md = `## Decisions\n\n### Decision 1\n\nfoo\n\n### Decision 2\n\nbar\n`;
    const sections = parseSections(md);
    expect(sections).toHaveLength(1);
    expect(sections[0].body).toContain('### Decision 1');
    expect(sections[0].body).toContain('### Decision 2');
  });

  it('strips YAML frontmatter before parsing', () => {
    const md = `---\nfoo: bar\nbaz: qux\n---\n\n## Overview\n\nbody\n`;
    const sections = parseSections(md);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe('Overview');
  });

  it('returns empty array for a doc with no H2s', () => {
    const md = `# Title only\n\nSome body, no sections.\n`;
    expect(parseSections(md)).toEqual([]);
  });

  it('returns empty array for empty markdown', () => {
    expect(parseSections('')).toEqual([]);
  });
});

describe('canonicalize', () => {
  it.each([
    ['Decisions', 'decisions'],
    ['Out-of-scope (v1)', 'out-of-scope-v1'],
    ['Rationalizations to reject', 'rationalizations-to-reject'],
    ['Success criteria', 'success-criteria'],
    ['Technical Design', 'technical-design'],
    ['   spaced   ', 'spaced'],
  ])('canonicalize(%j) → %j', (input, expected) => {
    expect(canonicalize(input)).toBe(expected);
  });
});
