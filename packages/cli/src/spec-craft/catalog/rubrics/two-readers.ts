import type { SpecRubric } from './index.js';

export const twoReadersRubric: SpecRubric = {
  id: 'SPEC-R003',
  title: 'Two readers, same understanding',
  description:
    'Could two reasonable readers extract the same load-bearing meaning from this ' +
    'section? Ambiguity is the failure mode. Watch for: weasel words that let each ' +
    'reader pick their own interpretation, decisions that read as both reversible ' +
    'and irreversible, success criteria measurable in multiple incompatible ways.',
  source: 'Karlton + Brooks, "No Silver Bullet" (essential complexity of specs)',
  appliesToSections: ['decisions', 'success-criteria'],
  contribution: { addedAt: '2026-05-25', addedBy: 'seed' },
  signal: { invocations: 0, suppressedAt: [] },
  version: 1,
};
