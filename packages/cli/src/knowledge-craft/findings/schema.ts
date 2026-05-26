/**
 * KnowledgeFinding schema — 3-axis (ADR 0019) finding emitted by
 * knowledge-craft. Imports shared craft axes from
 * packages/cli/src/shared/craft/.
 *
 * Source: docs/changes/craft-pipeline/knowledge-craft/proposal.md
 *   (Outputs → KnowledgeFinding).
 */

import type { Tier, Impact, Confidence } from '../../shared/craft/findings/axes.js';

export type { Tier, Impact, Confidence };

export interface KnowledgeFinding {
  /** Stable code in KNOW-R\d{3} namespace. */
  code: string;
  /** Always 'critique' in v1 (no POLISH phase yet). */
  phase: 'critique';
  tier: Tier;
  impact: Impact;
  confidence: Confidence;
  target: {
    file: string;
    /** Relative path from docs/knowledge/ for display. */
    relative: string;
  };
  message: string;
  cite: { rubricId: string; source: string };
  derived: { priority: number };
}

export interface KnowledgeCraftSummary {
  phaseRun: ['critique'];
  mode: 'fast';
  durationMs: number;
  llmCalls: { provider: string; model: string; count: number; costUsd: number };
  catalog: { rubricsApplied: string[] };
  counts: {
    filesScanned: number;
    filesSkipped: number;
  };
  runId: string;
}

export interface KnowledgeCraftOutput {
  findings: KnowledgeFinding[];
  summary: KnowledgeCraftSummary;
}
