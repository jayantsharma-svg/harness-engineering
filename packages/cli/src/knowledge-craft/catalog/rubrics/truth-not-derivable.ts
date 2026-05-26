import type { KnowledgeRubric } from './types.js';

export const truthNotDerivableRubric: KnowledgeRubric = {
  id: 'KNOW-R002',
  title: 'Truth a code reader could not derive from the code',
  description:
    "A useful knowledge entry states something a code reader couldn't infer from reading the " +
    'code itself. Constraints from upstream systems, historical reasons for non-obvious ' +
    "patterns, external contracts that shaped the design, business rules that don't appear " +
    'as code (rate limits negotiated with a vendor; data retention required by compliance; ' +
    'an API quirk that necessitates the workaround). Watch for: entries that a junior could ' +
    "reproduce by reading 3 files and tsdoc — those don't add value; the code already speaks.",
  source: "Hunt & Thomas, Pragmatic Programmer + Fowler on knowledge that doesn't live in code",
  contribution: { addedAt: '2026-05-26', addedBy: 'seed' },
  signal: { invocations: 0, suppressedAt: [] },
  version: 1,
};
