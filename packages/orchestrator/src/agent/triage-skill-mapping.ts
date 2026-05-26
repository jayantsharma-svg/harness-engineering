import type { TriageSkill } from '../core/triage-router';
import type { SkillCatalogEntry } from '../workflow/skill-catalog';

/**
 * Spec B Phase 3: map a {@link TriageSkill} (the coarse, hard-coded
 * skill set the triage router produces) to a concrete catalog skill
 * name + its declared cognitive_mode (if any), via the
 * `harness-<triageSkill>` naming convention.
 *
 * Returns `undefined` when the catalog has no matching entry — the
 * caller (the dispatch-site `buildRoutingUseCase`) then falls through
 * to per-tier resolution, preserving today's behavior (F11/N2).
 *
 * Why a naming-convention bridge: today the orchestrator's dispatch
 * is issue-shaped, not skill-shaped. Threading a richer "issue carries
 * skill" abstraction through state would be a larger refactor that
 * does not block Phase 3 success criteria. The convention is
 * documented and consistent with all Tier-1 skills shipping today
 * (`harness-debugging`, `harness-tdd`, ...). See Phase 3 plan C1.
 */
export interface ResolvedTriageSkill {
  readonly name: string;
  readonly cognitiveMode?: string;
}

export function resolveSkillForTriage(
  triageSkill: TriageSkill,
  catalog: readonly SkillCatalogEntry[]
): ResolvedTriageSkill | undefined {
  const expected = `harness-${triageSkill}`;
  const match = catalog.find((e) => e.name === expected);
  if (!match) return undefined;
  return match.cognitiveMode !== undefined
    ? { name: match.name, cognitiveMode: match.cognitiveMode }
    : { name: match.name };
}
