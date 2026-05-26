import type { KnowledgeRubric } from './index.js';

export const deletingLosesSomethingRubric: KnowledgeRubric = {
  id: 'KNOW-R005',
  title: 'Deleting this entry would lose specific knowledge',
  description:
    'Imagine deleting this entry tomorrow. Would the team lose specific, recoverable-only-from-memory ' +
    'knowledge? Or is the entry redundant with code, with another entry, or with a quick scan of ' +
    'the repo? Watch for: entries that duplicate well-named code; entries that summarize what ' +
    'another knowledge entry already covers; entries that are a list of links someone could ' +
    'regenerate by grepping; entries that paraphrase a well-known pattern ("we use the repository ' +
    'pattern" — every reader can see that). A high-value entry leaves a visible hole if removed.',
  source: 'Deletion-pressure principle (the cost of carrying state)',
  contribution: { addedAt: '2026-05-26', addedBy: 'seed' },
  signal: { invocations: 0, suppressedAt: [] },
  version: 1,
};
