/**
 * Severity resolution — `design.strictness` × per-finding default →
 * actual emitted severity.
 *
 * This module owns the full strictness matrix referenced in
 * `convention-runner.ts` (TODO comment in defaultSeverityForCode) and
 * planned in proposal.md § "Implementation Order" → Phase 3.1 "Severity
 * model implementation".
 *
 * Matrix (mirrors the harness-accessibility convention so consumers of
 * both audits experience consistent severity behaviour):
 *
 *   defaultSeverity:           error    warn    info
 *   strictness=strict      →   error    error   info
 *   strictness=standard    →   error    warn    info
 *   strictness=permissive  →   warn     info    info
 *
 * `info` is never promoted (an info finding is always authoring guidance);
 * `error` only ever softens under `permissive` (one step down to `warn`).
 *
 * The matrix is intentionally simple and table-driven so future audits
 * can adopt it verbatim. See ADR draft 0020 (cross-skill deferral) for
 * the cross-audit consistency rationale.
 *
 * Source: docs/changes/design-pipeline/audit-component-anatomy/proposal.md
 *  (Technical Design → severity rules; Success Criteria SC-11).
 */

import type { Severity } from './finding.js';

/** Design-strictness levels — sourced from harness.config.json. */
export type DesignStrictness = 'strict' | 'standard' | 'permissive';

/**
 * Resolve the emitted severity for a finding given the project's
 * `design.strictness` setting and the finding's own default severity.
 *
 * `strictness` defaults to `'standard'` when unspecified, matching the
 * documented behaviour of `harness.config.json` (the default value
 * surfaced when the key is omitted).
 */
export function resolveSeverity(
  severityDefault: Severity,
  strictness: DesignStrictness = 'standard'
): Severity {
  if (strictness === 'strict') {
    // Strict promotes warn → error; error stays error; info stays info
    // (info findings carry authoring guidance, not violations).
    if (severityDefault === 'warn') return 'error';
    return severityDefault;
  }

  if (strictness === 'permissive') {
    // Permissive softens by one step (error → warn, warn → info, info → info).
    if (severityDefault === 'error') return 'warn';
    if (severityDefault === 'warn') return 'info';
    return 'info';
  }

  // standard — pass through (already aligned with default severity).
  return severityDefault;
}

/**
 * Default severity for a finding code based on its tier band, per
 * `finding-codes.md`:
 *   - ANAT-D000      → info  (authoring divergence guidance)
 *   - ANAT-D001-D029 → error (Tier-1 critical: required slot missing)
 *   - ANAT-D030-D099 → warn  (Tier-2 important)
 *   - ANAT-D100-D199 → info  (Tier-3 advisory)
 *   - ANAT-P001-P099 → warn  (pattern-presence: warn by default)
 *   - ANAT-P100-P199 → info  (pattern-presence advisory band)
 *   - everything else → warn (conservative)
 *
 * Rules MAY override their own default — pattern rules in particular
 * commonly downgrade themselves to `info` when the rule is structurally
 * ambiguous (e.g. ANAT-P004 conditional-render-without-fallback per the
 * Phase 0 spike).
 */
export function defaultSeverityForCode(code: string): Severity {
  const definitionMatch = /^ANAT-D(\d{3})$/.exec(code);
  if (definitionMatch) {
    const n = Number(definitionMatch[1]);
    if (n === 0) return 'info';
    if (n >= 1 && n <= 29) return 'error';
    if (n >= 30 && n <= 99) return 'warn';
    if (n >= 100 && n <= 199) return 'info';
  }

  const patternMatch = /^ANAT-P(\d{3})$/.exec(code);
  if (patternMatch) {
    const n = Number(patternMatch[1]);
    if (n >= 1 && n <= 99) return 'warn';
    if (n >= 100 && n <= 199) return 'info';
  }

  return 'warn';
}
