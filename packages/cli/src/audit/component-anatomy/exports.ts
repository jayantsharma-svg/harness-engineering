/**
 * Public exports surface for `audit-component-anatomy`.
 *
 * This module is the stable contract consumed by sibling skills. The
 * primary consumer today is `harness-accessibility` (Phase 1 step 2.6
 * deferral), which loads the catalog component-type set via
 * `getCatalogTypes()` to decide which JSX elements to defer
 * A11Y-010 / A11Y-050 findings for.
 *
 * Anything not re-exported from here is internal — internal modules
 * may move or change shape between minor versions. Add exports here
 * only when a contract is intended to be stable across releases.
 *
 * Reference:
 *  - docs/changes/design-pipeline/audit-component-anatomy/proposal.md
 *    § Integration Points → "Skill module export"
 *  - agents/skills/<platform>/harness-accessibility/SKILL.md
 *    § Phase 1 step 2.6 (overlap deferral)
 */

export { getCatalogTypes } from './catalog/index.js';
export type { AnatomyFinding, AnatomyFindingCode, Severity } from './findings/finding.js';
