export interface NamingRubric {
  id: string;
  title: string;
  /** Concise rubric description used as part of the LLM prompt. */
  description: string;
  /** Authoritative citation for the rubric (Martin, Beck, etc.). */
  source: string;
  /** Identifier kinds this rubric applies to. */
  appliesTo: ReadonlyArray<'variable' | 'function' | 'type' | 'file'>;
  /** ADR 0020 — catalog growth metadata (reserved, not consumed in v1). */
  contribution: { addedAt: string; addedBy: string };
  signal: { invocations: number; suppressedAt: string[] };
  version: number;
}
