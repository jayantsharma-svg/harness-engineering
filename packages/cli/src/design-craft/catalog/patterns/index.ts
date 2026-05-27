// packages/cli/src/design-craft/catalog/patterns/index.ts
//
// Barrel for the Phase 2 seed of polish patterns. Mirrors the rubrics
// barrel structure so the orchestrator can load the catalog in a single
// shape regardless of which phase consumes it.

export type { PatternDefinition, PatternApplicability } from './spring-physics.js';

import type { PatternDefinition } from './spring-physics.js';
import { springPhysicsPattern } from './spring-physics.js';

export { springPhysicsPattern } from './spring-physics.js';

/**
 * Phase 2 seed polish patterns. Starts with one pattern (spring-physics)
 * to anchor the schema; subsequent commits extend to the full 15-pattern
 * seed (3 motion + 3 skeleton + 3 typography + 3 interaction + 3 layout)
 * per the spec.
 */
export const SEED_PATTERNS: readonly PatternDefinition[] = [springPhysicsPattern];
