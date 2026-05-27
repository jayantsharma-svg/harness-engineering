// packages/cli/src/design-craft/catalog/exemplars/index.ts
//
// Barrel for the Phase 2 seed of exemplars.

export type { ExemplarDefinition, RadarReference, ComponentType } from './linear-empty-list.js';

import type { ExemplarDefinition } from './linear-empty-list.js';
import { linearEmptyListExemplar } from './linear-empty-list.js';

export { linearEmptyListExemplar } from './linear-empty-list.js';

/**
 * Phase 2 seed exemplars. Starts with one (Linear empty-list) to anchor the
 * `ExemplarDefinition` shape; the full 50-exemplar seed grows from here per
 * the spec.
 */
export const SEED_EXEMPLARS: readonly ExemplarDefinition[] = [linearEmptyListExemplar];
