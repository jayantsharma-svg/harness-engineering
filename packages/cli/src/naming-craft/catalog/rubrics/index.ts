/**
 * Living catalog (ADR 0020) — seed rubrics for naming-craft v1.
 * Each rubric is a separate file under ./rubrics/. The registry below
 * gates which rubrics are available at runtime; future contribution
 * mechanism (proposal → review → version bump) will land at v1.x.
 *
 * Source: docs/changes/craft-pipeline/naming-craft/proposal.md
 *   (Technical Design → Living catalog H).
 */

export type { NamingRubric } from './types.js';

import type { NamingRubric } from './types.js';
import { predictivePowerRubric } from './predictive-power.js';
import { concretenessRubric } from './concreteness.js';
import { verbNounHonestyRubric } from './verb-noun-honesty.js';
import { conventionConformanceRubric } from './convention-conformance.js';
import { scopeMatchRubric } from './scope-match.js';
import { encodedMeasureRubric } from './encoded-measure.js';

/**
 * The v1 default rubric set — 6 seed entries from Martin, Beck, Karlton,
 * and the wider naming canon. Order is intentional: rubrics earlier in
 * the list run first in the critique loop so cost-capped runs still see
 * the highest-value findings.
 */
export const SEED_RUBRICS: ReadonlyArray<NamingRubric> = [
  predictivePowerRubric,
  concretenessRubric,
  verbNounHonestyRubric,
  conventionConformanceRubric,
  scopeMatchRubric,
  encodedMeasureRubric,
];
