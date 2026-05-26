import type { KnowledgeRubric } from './index.js';

export const specificNotGenericRubric: KnowledgeRubric = {
  id: 'KNOW-R006',
  title: 'Concrete and operationally defined (not platitudes)',
  description:
    'Claims should be concrete and operationally defined, not platitudes. "The system is ' +
    'scalable" tells the reader nothing they can act on; "the system scales to 10k RPS per ' +
    'instance with p99 < 200ms" is operational. "Security is important" vs "all user-facing ' +
    'endpoints require authenticated sessions; service-to-service uses mTLS". "We value ' +
    'simplicity" vs "we reject patterns that require three or more files to grok". Watch for: ' +
    'abstractions without referents, virtue statements without enforcement, principles without ' +
    'examples or counter-examples. Specific is useful; vague is decoration.',
  source: 'Specificity principle (reused from spec/copy-craft family)',
  contribution: { addedAt: '2026-05-26', addedBy: 'seed' },
  signal: { invocations: 0, suppressedAt: [] },
  version: 1,
};
