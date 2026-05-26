export type SectionMatcher = string | RegExp;

export interface SpecRubric {
  id: string;
  title: string;
  /** Concise description used as part of the LLM prompt. */
  description: string;
  /** Authoritative citation for the rubric. */
  source: string;
  /**
   * Section canonical names (or regex) this rubric applies to.
   * Use ['*'] to apply to every section.
   */
  appliesToSections: SectionMatcher[];
  /** ADR 0020 — catalog growth metadata (reserved). */
  contribution: { addedAt: string; addedBy: string };
  signal: { invocations: number; suppressedAt: string[] };
  version: number;
}

export function rubricApplies(rubric: SpecRubric, sectionCanonical: string): boolean {
  for (const matcher of rubric.appliesToSections) {
    if (matcher === '*') return true;
    if (typeof matcher === 'string' && matcher === sectionCanonical) return true;
    if (matcher instanceof RegExp && matcher.test(sectionCanonical)) return true;
  }
  return false;
}
