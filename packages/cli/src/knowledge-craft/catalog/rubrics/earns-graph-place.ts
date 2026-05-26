import type { KnowledgeRubric } from './index.js';

export const earnsGraphPlaceRubric: KnowledgeRubric = {
  id: 'KNOW-R003',
  title: 'Earns a place in the knowledge graph taxonomy',
  description:
    'Would this entry fit cleanly as one of `business_fact`, `business_rule`, ' +
    '`business_concept`, or `business_decision` in the knowledge graph? If yes, name ' +
    'which type it best fits. If the entry is too vague, too narrative, or too short-lived ' +
    "to fit any of these (it's scratchpad-quality, a discussion log, or transient context), " +
    "it's likely not earning its place as a knowledge entry — it might belong in an RFC, " +
    'a PR description, or a Slack thread instead. The taxonomy: `business_fact` is a ' +
    'stable truth about the domain; `business_rule` is a constraint that governs behavior; ' +
    '`business_concept` is a named domain entity; `business_decision` is a recorded choice ' +
    'with rationale.',
  source:
    'harness-knowledge-pipeline graph taxonomy (business_fact / business_rule / business_concept / business_decision)',
  contribution: { addedAt: '2026-05-26', addedBy: 'seed' },
  signal: { invocations: 0, suppressedAt: [] },
  version: 1,
};
