import type { SpecRubric } from './index.js';

export const nonGoalsHonestyRubric: SpecRubric = {
  id: 'SPEC-R006',
  title: 'Non-goals are non-goals (no smuggled assumptions)',
  description:
    'Does the Out-of-scope section list real trade-offs the project explicitly ' +
    'made, or does it smuggle assumptions disguised as non-goals? A real non-goal ' +
    'is something a reasonable reader might have expected, called out and deferred ' +
    'with rationale. A smuggled assumption masquerades as "out of scope" to avoid ' +
    'justifying it.',
  source: 'Joel Spolsky, "Painless Functional Specifications" (intentional deferrals only)',
  appliesToSections: [/^out-of-scope/, /^non-goals/],
  contribution: { addedAt: '2026-05-25', addedBy: 'seed' },
  signal: { invocations: 0, suppressedAt: [] },
  version: 1,
};
