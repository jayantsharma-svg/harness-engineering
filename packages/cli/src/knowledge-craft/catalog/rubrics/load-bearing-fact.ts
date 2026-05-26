import type { KnowledgeRubric } from './index.js';

export const loadBearingFactRubric: KnowledgeRubric = {
  id: 'KNOW-R001',
  title: 'States a load-bearing fact (not paraphrase of code)',
  description:
    'A knowledge entry earns its place by stating a load-bearing FACT about the domain — ' +
    "a constraint, invariant, decision, or 'this is the way it works' — not by paraphrasing " +
    'what the code already says. "The user service validates emails via the EmailValidator class" ' +
    'is paraphrase (a code reader sees this). "Emails must round-trip through Postmark within ' +
    '30 seconds for deliverability tracking" is a load-bearing fact (the reader can\'t infer ' +
    'this from the validator code). Watch for: entries that read like API documentation, ' +
    "entries that summarize a single file's contents, entries that restate the obvious.",
  source: 'Pragmatic Programmer + general knowledge-management folklore (the WHY principle)',
  contribution: { addedAt: '2026-05-26', addedBy: 'seed' },
  signal: { invocations: 0, suppressedAt: [] },
  version: 1,
};
