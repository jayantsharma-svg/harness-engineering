// packages/cli/src/design-craft/catalog/rubrics/index.ts
//
// Barrel for the Phase 2 seed of critique rubrics. Re-exports the
// canonical `RubricDefinition` type plus the three seed entries authored
// from the Phase 0 paper spike.
//
// Order matters: CRAFT-C001/002/003 align to the array order so finding
// listings and the markdown formatter render rubrics in a stable sequence.

export type {
  RubricDefinition,
  RubricScope,
  CatalogSource,
  CatalogStatus,
  FindingTemplate,
} from './hierarchy-clarity.js';

import type { RubricDefinition } from './hierarchy-clarity.js';
import { hierarchyClarityRubric } from './hierarchy-clarity.js';
import { typographyCraftRubric } from './typography-craft.js';
import { motionQualityRubric } from './motion-quality.js';

export { hierarchyClarityRubric } from './hierarchy-clarity.js';
export { typographyCraftRubric } from './typography-craft.js';
export { motionQualityRubric } from './motion-quality.js';

/**
 * Phase 2 seed critique rubrics. The Phase 1 vertical slice shipped only
 * `hierarchy-clarity`; this barrel widens the seed to three so the
 * CRITIQUE phase exercises the rubric loop, not just a single iteration.
 */
export const SEED_RUBRICS: readonly RubricDefinition[] = [
  hierarchyClarityRubric,
  typographyCraftRubric,
  motionQualityRubric,
];
