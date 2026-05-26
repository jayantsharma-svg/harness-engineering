export interface TestRubric {
  id: string;
  title: string;
  description: string;
  source: string;
  /** ADR 0020 — catalog growth metadata (reserved). */
  contribution: { addedAt: string; addedBy: string };
  signal: { invocations: number; suppressedAt: string[] };
  version: number;
}
