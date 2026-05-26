import type { KnowledgeRubric } from './index.js';

export const strangerInSixMonthsRubric: KnowledgeRubric = {
  id: 'KNOW-R007',
  title: 'A stranger could pick this up six months from now',
  description:
    'Could a new teammate read this entry six months from now, with no parallel context ' +
    '(no Slack thread to scroll back through, no PR to read, no person to ask), and use it? ' +
    'Watch for: pronouns that reference unnamed things ("we decided this" — who\'s we, what\'s ' +
    'this?); transient context ("as discussed last week" rots immediately); acronyms or ' +
    'internal jargon used without definition; references to people by first name without role ' +
    '("Sarah said" — which Sarah, when, why does it matter?); claims that depend on a moment ' +
    'in time ("the current sprint") without anchoring the moment.',
  source: 'Durability principle (reused from spec-craft + copy-craft)',
  contribution: { addedAt: '2026-05-26', addedBy: 'seed' },
  signal: { invocations: 0, suppressedAt: [] },
  version: 1,
};
