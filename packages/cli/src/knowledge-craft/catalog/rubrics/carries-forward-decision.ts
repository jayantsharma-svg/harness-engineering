import type { KnowledgeRubric } from './types.js';

export const carriesForwardDecisionRubric: KnowledgeRubric = {
  id: 'KNOW-R004',
  title: 'Carries forward a decision that would otherwise erode',
  description:
    'A knowledge entry serves the future by capturing the WHY of a non-obvious choice — ' +
    'with the alternative considered AND the reason it lost. "We use Postgres" is a statement; ' +
    '"We use Postgres over DynamoDB because our access patterns are relational and the team\'s ' +
    'ops muscle is in SQL" carries forward a decision. Watch for: entries that state what is ' +
    'without saying why, entries that present a choice without naming the alternatives ' +
    'considered, entries that hide the tradeoff. Without the WHY and the alternative, the ' +
    "decision erodes — six months later someone considers DynamoDB again because they don't " +
    'know it was already rejected.',
  source: 'ADR pattern (Nygard) + Why-not-X documentation principle',
  contribution: { addedAt: '2026-05-26', addedBy: 'seed' },
  signal: { invocations: 0, suppressedAt: [] },
  version: 1,
};
