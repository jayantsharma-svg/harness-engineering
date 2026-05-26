import type { SpecRubric } from './types.js';

export const strangerInSixMonthsRubric: SpecRubric = {
  id: 'SPEC-R007',
  title: 'Stranger in 6 months',
  description:
    'Could a stranger picking up this spec 6 months from now still act on it ' +
    'without parallel context? Watch for: references to "the recent discussion" ' +
    'or "as we agreed", names of people without their role, deadlines without ' +
    'dates, dependencies on specific PR / Slack threads not linked, jargon ' +
    "specific to this team's current vocabulary. Specs are time capsules; assume " +
    'the reader has none of your current context.',
  source: 'Software-engineering folklore + the durability principle (specs as time capsules)',
  appliesToSections: ['*'],
  contribution: { addedAt: '2026-05-25', addedBy: 'seed' },
  signal: { invocations: 0, suppressedAt: [] },
  version: 1,
};
