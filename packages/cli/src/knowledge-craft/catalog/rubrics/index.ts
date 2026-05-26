/**
 * Living catalog (ADR 0020) — seed rubrics for knowledge-craft v1.
 *
 * Source: docs/changes/craft-pipeline/knowledge-craft/proposal.md
 *   (Scope → 7 seed rubrics).
 */

export type { KnowledgeRubric } from './types.js';

import type { KnowledgeRubric } from './types.js';
import { loadBearingFactRubric } from './load-bearing-fact.js';
import { truthNotDerivableRubric } from './truth-not-derivable.js';
import { earnsGraphPlaceRubric } from './earns-graph-place.js';
import { carriesForwardDecisionRubric } from './carries-forward-decision.js';
import { deletingLosesSomethingRubric } from './deleting-loses-something.js';
import { specificNotGenericRubric } from './specific-not-generic.js';
import { strangerInSixMonthsRubric } from './stranger-in-6-months.js';

/**
 * v1 default rubric set — 7 seed entries for knowledge-entry quality.
 */
export const SEED_RUBRICS: ReadonlyArray<KnowledgeRubric> = [
  loadBearingFactRubric,
  truthNotDerivableRubric,
  earnsGraphPlaceRubric,
  carriesForwardDecisionRubric,
  deletingLosesSomethingRubric,
  specificNotGenericRubric,
  strangerInSixMonthsRubric,
];
