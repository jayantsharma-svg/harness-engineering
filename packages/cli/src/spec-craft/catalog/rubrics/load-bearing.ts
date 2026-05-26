import type { SpecRubric } from './types.js';

export const loadBearingRubric: SpecRubric = {
  id: 'SPEC-R004',
  title: 'Load-bearing decision vs ambient context',
  description:
    'Is the section signal-rich, or does it pad load-bearing decisions with ' +
    'background that obscures them? A great Decisions section names the trade-off, ' +
    'the chosen path, and the rationale in a few words each. A weak one buries the ' +
    'actual choice under restatements of the problem.',
  source: 'Strunk + White, "Omit needless words" (signal-to-noise applied to spec sections)',
  appliesToSections: ['decisions', 'overview'],
  contribution: { addedAt: '2026-05-25', addedBy: 'seed' },
  signal: { invocations: 0, suppressedAt: [] },
  version: 1,
};
