import type { Issue, RoutingUseCase } from '@harness-engineering/types';
import { triageIssue } from '../core/triage-router';
import { detectScopeTier, artifactPresenceFromIssue } from '../core/model-router';
import { resolveSkillForTriage } from './triage-skill-mapping';
import type { SkillCatalogEntry } from '../workflow/skill-catalog';

/**
 * Spec B Phase 3: construct a {@link RoutingUseCase} from a dispatch
 * request. Replaces the Phase-2-era `useCaseForBackendParam` (which
 * only emitted `kind: 'tier'`) so per-skill / per-mode routing can fire
 * at the orchestrator dispatch site (F1/F2).
 *
 * Resolution semantics:
 *  - `backendParam === 'local'` → `{ kind: 'tier', tier: 'quick-fix' }`
 *    (preserves the legacy local-dispatch convention; ad-hoc dashboard
 *    dispatch consults this branch — see `orchestrator.dispatchAdHoc`).
 *  - Otherwise: triage the issue, attempt catalog mapping. On match,
 *    emit `{ kind: 'skill', skillName, cognitiveMode? }`. On miss,
 *    fall back to the issue's scope-tier (F11 / N2).
 *
 * Pure function; takes the catalog as a parameter so the construction
 * site is unit-testable without instantiating an Orchestrator.
 */
export function buildRoutingUseCase(
  issue: Issue,
  backendParam: 'local' | 'primary' | undefined,
  catalog: readonly SkillCatalogEntry[]
): RoutingUseCase {
  if (backendParam === 'local') return { kind: 'tier', tier: 'quick-fix' };

  // Triage with no extra signals — the orchestrator does not derive
  // diff-level signals at this point in the flow. Title-prefix +
  // labels are enough to drive the catalog lookup; Phase 4+ may
  // enrich with diff signals if richer routing is needed.
  const decision = triageIssue(issue, {});
  const resolved = resolveSkillForTriage(decision.skill, catalog);
  if (resolved) {
    return resolved.cognitiveMode !== undefined
      ? { kind: 'skill', skillName: resolved.name, cognitiveMode: resolved.cognitiveMode }
      : { kind: 'skill', skillName: resolved.name };
  }

  const tier = detectScopeTier(issue, artifactPresenceFromIssue(issue));
  return { kind: 'tier', tier };
}
