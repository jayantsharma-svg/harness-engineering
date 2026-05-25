import type { SpecRubric } from './index.js';

export const honestRationalizationsRubric: SpecRubric = {
  id: 'SPEC-R005',
  title: 'Honest rationalizations',
  description:
    'When the Rationalizations-to-reject section is critiqued: are the rejected ' +
    'arguments stated charitably (steelmanned) or strawmanned? A strawmanned ' +
    'rationalization is worse than none — it lets the author dismiss a real ' +
    'objection without engaging it. Each entry should be one a reasonable ' +
    'reader could have raised, paired with a specific reason for rejection.',
  source: 'Eliezer Yudkowsky, "The Least Convenient Possible World" + general rationalist canon',
  appliesToSections: [/^rationalizations/],
  contribution: { addedAt: '2026-05-25', addedBy: 'seed' },
  signal: { invocations: 0, suppressedAt: [] },
  version: 1,
};
