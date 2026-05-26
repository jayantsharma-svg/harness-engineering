/**
 * Living catalog (ADR 0020) — seed rubrics for security-craft v1.
 *
 * Each rubric declares `appliesToSignals` so per-(file, signal) critique
 * skips rubrics that aren't relevant to a detected signal kind. This is
 * the equivalent of spec-craft's per-section rubric mapping and is part
 * of the FP-management strategy (proposal Decisions #2 + #3).
 *
 * Source: docs/changes/craft-pipeline/security-craft/proposal.md
 *   (Scope → 8 seed rubrics + Rubric-to-signal mapping).
 */

export { rubricApplies } from './types.js';
export type { SecurityRubric } from './types.js';

import type { SecurityRubric } from './types.js';
import { trustBoundaryRespectedRubric } from './trust-boundary-respected.js';
import { leastAuthorityHonoredRubric } from './least-authority-honored.js';
import { defenseInDepthRubric } from './defense-in-depth.js';
import { assumedAdversaryRealisticRubric } from './assumed-adversary-realistic.js';
import { dataFlowAnnotatedRubric } from './data-flow-annotated.js';
import { failClosedNotOpenRubric } from './fail-closed-not-open.js';
import { secretHandlingShapeRubric } from './secret-handling-shape.js';
import { authzBeforeActionRubric } from './authz-before-action.js';

/**
 * v1 default rubric set — 8 seed entries for security posture critique.
 */
export const SEED_RUBRICS: ReadonlyArray<SecurityRubric> = [
  trustBoundaryRespectedRubric,
  leastAuthorityHonoredRubric,
  defenseInDepthRubric,
  assumedAdversaryRealisticRubric,
  dataFlowAnnotatedRubric,
  failClosedNotOpenRubric,
  secretHandlingShapeRubric,
  authzBeforeActionRubric,
];
