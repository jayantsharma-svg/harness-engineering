import { describe, expect, it } from 'vitest';
import { parseStrategyDoc, asStrategyDoc } from './parser';
import { StrategyDocSchema, StrategyFrontmatterSchema } from './schema';

const VALID = `---
name: Acme Widgets
last_updated: 2026-06-02
version: 1
---

## Target problem

Widget makers ship inconsistent UIs because they lack shared primitives.

## Our approach

We sell a hosted component registry that enforces brand contracts at build time.

## Who it's for

Mid-stage product teams (10-50 engineers).

## Key metrics

- Weekly active component installs

## Tracks

- Hosted registry: stabilize public API
`;

function parsed(raw: string) {
  const p = parseStrategyDoc(raw);
  return { p, doc: asStrategyDoc(p) };
}

describe('StrategyFrontmatterSchema', () => {
  it('accepts a well-formed frontmatter object', () => {
    expect(
      StrategyFrontmatterSchema.safeParse({
        name: 'X',
        last_updated: '2026-06-02',
        version: 1,
      }).success
    ).toBe(true);
  });

  it.each([
    [{ name: '', last_updated: '2026-06-02', version: 1 }, /name/i],
    [{ name: 'X', last_updated: '06/02/2026', version: 1 }, /last_updated|YYYY-MM-DD/i],
    [{ name: 'X', last_updated: '2026-06-02', version: 0 }, /version/i],
    [{ name: 'X', last_updated: '2026-06-02', version: 1.5 }, /integer/i],
  ])('rejects malformed frontmatter %#', (input, pattern) => {
    const result = StrategyFrontmatterSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toMatch(pattern);
    }
  });
});

describe('StrategyDocSchema', () => {
  it('accepts a complete document with required sections only', () => {
    const { doc } = parsed(VALID);
    expect(doc).not.toBeNull();
    const result = StrategyDocSchema.safeParse(doc);
    if (!result.success) {
      throw new Error(JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });

  it('accepts optional sections when their bodies have real content', () => {
    const withOptional =
      VALID +
      `
## Milestones

- v1 launch Q3 2026

## Not working on

- Mobile native shells until 2027
`;
    const { doc } = parsed(withOptional);
    const result = StrategyDocSchema.safeParse(doc);
    expect(result.success).toBe(true);
  });

  it('rejects a doc with a missing required section', () => {
    const noTracks = VALID.replace(/## Tracks[\s\S]*$/, '');
    const { doc } = parsed(noTracks);
    const result = StrategyDocSchema.safeParse(doc);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toMatch(/Tracks/);
    }
  });

  it('rejects an empty required section', () => {
    const empty = VALID.replace(/(## Tracks\n\n).*$/m, '$1\n');
    const { doc } = parsed(empty);
    const result = StrategyDocSchema.safeParse(doc);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toMatch(/Tracks/);
      expect(JSON.stringify(result.error.issues)).toMatch(/empty/i);
    }
  });

  it('rejects a doc whose section body is verbatim template placeholder text', () => {
    const placeholderRaw = `---
name: Acme
last_updated: 2026-06-02
version: 1
---

## Target problem

<2-4 sentences. What specifically is broken in the world that this product addresses?>

## Our approach

We sell a hosted component registry that enforces brand contracts.

## Who it's for

Mid-stage product teams.

## Key metrics

- m

## Tracks

- t
`;
    const { doc } = parsed(placeholderRaw);
    const result = StrategyDocSchema.safeParse(doc);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toMatch(/Target problem/);
      expect(JSON.stringify(result.error.issues)).toMatch(/placeholder/i);
    }
  });

  it('rejects a doc with a partially filled section that still contains a placeholder line', () => {
    const mixedRaw = `---
name: Acme
last_updated: 2026-06-02
version: 1
---

## Target problem

Real diagnosis sentence here.

## Our approach

Our distinctive bet on the problem.

## Who it's for

Mid-stage product teams.

## Key metrics

- <metric 1>: <how it's measured, where it lives>

## Tracks

- t
`;
    const { doc } = parsed(mixedRaw);
    const result = StrategyDocSchema.safeParse(doc);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toMatch(/Key metrics/);
      expect(JSON.stringify(result.error.issues)).toMatch(/placeholder/i);
    }
  });

  it('rejects an unknown section even if all required sections are present', () => {
    const rogue = VALID + '\n\n## Vision\n\nWe will save the world.\n';
    const { doc } = parsed(rogue);
    const result = StrategyDocSchema.safeParse(doc);
    // The parser drops unknown sections by name (they never make it to schema
    // sections), so this passes — Vision is silently discarded by the parser
    // rather than rejected. The schema-level check exists for callers that
    // construct a doc programmatically without going through the parser.
    expect(result.success).toBe(true);

    // Direct schema check — construct a doc with an unknown section name.
    const direct = StrategyDocSchema.safeParse({
      frontmatter: {
        name: 'X',
        last_updated: '2026-06-02',
        version: 1,
      },
      sections: [{ name: 'Vision', body: 'real text' }, ...(doc?.sections ?? [])],
    });
    expect(direct.success).toBe(false);
  });

  it('accepts inline angle-bracket content that is not a sole placeholder line', () => {
    const inlineAngle = VALID.replace(
      '## Target problem\n\nWidget makers',
      '## Target problem\n\nSee <https://example.com/discovery> for context. Widget makers'
    );
    const { doc } = parsed(inlineAngle);
    const result = StrategyDocSchema.safeParse(doc);
    expect(result.success).toBe(true);
  });
});
