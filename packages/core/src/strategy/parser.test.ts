import { describe, expect, it } from 'vitest';
import { parseStrategyDoc, asStrategyDoc } from './parser';

const VALID = `---
name: Acme Widgets
last_updated: 2026-06-02
version: 1
---

# Acme Widgets Strategy

## Target problem

Widget makers ship inconsistent UIs because they lack shared primitives.

## Our approach

We sell a hosted component registry that enforces brand contracts at build time.

## Who it's for

Mid-stage product teams (10-50 engineers) shipping multi-surface React apps.

## Key metrics

- Weekly active component installs
- p95 build-time check latency

## Tracks

- Hosted registry: stabilize public API, harden CI integration
- CLI: ship first-class diff/preview command
`;

describe('parseStrategyDoc', () => {
  it('splits frontmatter and known H2 sections', () => {
    const parsed = parseStrategyDoc(VALID);
    expect(parsed.frontmatter).toEqual({
      name: 'Acme Widgets',
      last_updated: '2026-06-02',
      version: 1,
    });
    expect(parsed.sections.map((s) => s.name)).toEqual([
      'Target problem',
      'Our approach',
      "Who it's for",
      'Key metrics',
      'Tracks',
    ]);
    expect(parsed.unknownSectionNames).toEqual([]);
  });

  it('captures section body verbatim (trimmed) up to next H2', () => {
    const parsed = parseStrategyDoc(VALID);
    const keyMetrics = parsed.sections.find((s) => s.name === 'Key metrics');
    expect(keyMetrics?.body).toBe(
      '- Weekly active component installs\n- p95 build-time check latency'
    );
  });

  it('records unknown section names without throwing', () => {
    const raw = `---
name: X
last_updated: 2026-01-01
version: 1
---

## Target problem
real text

## Vision
unexpected section
`;
    const parsed = parseStrategyDoc(raw);
    expect(parsed.unknownSectionNames).toEqual(['Vision']);
    expect(parsed.sections.map((s) => s.name)).toEqual(['Target problem']);
  });

  it('discards H1 and leading prose before the first H2', () => {
    const raw = `---
name: X
last_updated: 2026-01-01
version: 1
---

# Big Title

intro text that should not become a section

## Target problem
real text
`;
    const parsed = parseStrategyDoc(raw);
    expect(parsed.sections).toHaveLength(1);
    expect(parsed.sections[0]?.name).toBe('Target problem');
  });

  it('handles optional sections without flagging them as unknown', () => {
    const raw = `---
name: X
last_updated: 2026-01-01
version: 1
---

## Target problem
real text

## Our approach
real text

## Who it's for
real text

## Key metrics
- m

## Tracks
- t

## Milestones
m1

## Not working on
n1

## Marketing
mk1
`;
    const parsed = parseStrategyDoc(raw);
    expect(parsed.unknownSectionNames).toEqual([]);
    expect(parsed.sections.map((s) => s.name)).toContain('Milestones');
    expect(parsed.sections.map((s) => s.name)).toContain('Not working on');
    expect(parsed.sections.map((s) => s.name)).toContain('Marketing');
  });
});

describe('asStrategyDoc', () => {
  it('returns null when frontmatter fields are missing or wrong type', () => {
    expect(asStrategyDoc({ frontmatter: null, sections: [], unknownSectionNames: [] })).toBeNull();
    expect(
      asStrategyDoc({
        frontmatter: { name: 'X' },
        sections: [],
        unknownSectionNames: [],
      })
    ).toBeNull();
    expect(
      asStrategyDoc({
        frontmatter: { name: 'X', last_updated: '2026-01-01', version: 'one' },
        sections: [],
        unknownSectionNames: [],
      })
    ).toBeNull();
  });

  it('returns a typed StrategyDoc when frontmatter is well-formed', () => {
    const parsed = parseStrategyDoc(VALID);
    const doc = asStrategyDoc(parsed);
    expect(doc?.frontmatter.name).toBe('Acme Widgets');
    expect(doc?.sections).toHaveLength(5);
  });
});
