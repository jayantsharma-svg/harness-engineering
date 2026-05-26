import type { SpecRubric } from './types.js';

export const jointsRubric: SpecRubric = {
  id: 'SPEC-R002',
  title: 'Cuts at the joints',
  description:
    "Does the decomposition match the natural boundaries of the problem? Plato's " +
    '"carve nature at its joints" applied to specs: are the Decisions split where ' +
    'real trade-offs live, or arbitrarily grouped by convenience? Are the Scope ' +
    'in/out lines drawn where actual cost-of-change discontinuities sit?',
  source: 'Plato, Phaedrus 265e + Christopher Alexander, "A Pattern Language"',
  appliesToSections: ['decisions', 'scope', 'technical-design'],
  contribution: { addedAt: '2026-05-25', addedBy: 'seed' },
  signal: { invocations: 0, suppressedAt: [] },
  version: 1,
};
