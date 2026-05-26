/**
 * Living catalog (ADR 0020) — seed rubrics for spec-craft v1.
 * Each rubric is a separate file under ./rubrics/. The registry below
 * gates which rubrics are available at runtime; growth mechanism lands
 * at v1.x.
 *
 * Source: docs/changes/craft-pipeline/spec-craft/proposal.md
 *   (Technical Design → Rubric → section mapping).
 */

export { rubricApplies } from './types.js';
export type { SectionMatcher, SpecRubric } from './types.js';

import type { SpecRubric } from './types.js';
import { sharpnessRubric } from './sharpness.js';
import { jointsRubric } from './joints.js';
import { twoReadersRubric } from './two-readers.js';
import { loadBearingRubric } from './load-bearing.js';
import { honestRationalizationsRubric } from './honest-rationalizations.js';
import { nonGoalsHonestyRubric } from './non-goals-honesty.js';
import { strangerInSixMonthsRubric } from './stranger-in-6-months.js';

/**
 * The v1 default rubric set — 7 seed entries from the spec-quality canon.
 * Order is intentional: rubrics earlier in the list run first in the
 * critique loop so cost-capped runs still see the highest-value findings.
 */
export const SEED_RUBRICS: ReadonlyArray<SpecRubric> = [
  sharpnessRubric,
  jointsRubric,
  twoReadersRubric,
  loadBearingRubric,
  honestRationalizationsRubric,
  nonGoalsHonestyRubric,
  strangerInSixMonthsRubric,
];
