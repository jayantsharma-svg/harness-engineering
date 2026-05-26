import type { CopySurface } from '../../findings/schema.js';

export interface CopyRubric {
  id: string;
  title: string;
  description: string;
  source: string;
  /** Surfaces this rubric applies to. */
  appliesToSurfaces: CopySurface[];
  /** ADR 0020 — catalog growth metadata (reserved). */
  contribution: { addedAt: string; addedBy: string };
  signal: { invocations: number; suppressedAt: string[] };
  version: number;
}

export function rubricApplies(rubric: CopyRubric, surface: CopySurface): boolean {
  return rubric.appliesToSurfaces.includes(surface);
}
