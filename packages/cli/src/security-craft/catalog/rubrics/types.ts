import type { SignalKind } from '../../findings/schema.js';

export interface SecurityRubric {
  id: string;
  title: string;
  description: string;
  source: string;
  /** Signal kinds this rubric is critique-relevant for. */
  appliesToSignals: ReadonlyArray<SignalKind>;
  contribution: { addedAt: string; addedBy: string };
  signal: { invocations: number; suppressedAt: string[] };
  version: number;
}

/**
 * Returns true if the rubric should be invoked for the given signal kind.
 * Pre-filtering avoids LLM calls that would return null anyway.
 */
export function rubricApplies(rubric: SecurityRubric, signal: SignalKind): boolean {
  return rubric.appliesToSignals.includes(signal);
}
