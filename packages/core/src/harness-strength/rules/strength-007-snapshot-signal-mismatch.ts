import type { ProjectContext, StrengthFinding, StrengthRule } from '../types';

/**
 * STRENGTH-007 — snapshot/signal mismatch.
 *
 * Maps a health-snapshot check key to the `signals` entry that would CONTRADICT a
 * passing result for that check. Derived from this repo's live
 * `.harness/health-snapshot.json`, where `checks.security` is contradicted by the
 * `security-findings` signal. Signals outside this table are ignored (a documented
 * limitation, not a false pass).
 */
export const CHECK_SIGNAL_MAP: Record<string, string> = {
  security: 'security-findings',
  entropy: 'entropy-drift',
  deps: 'dependency-violations',
  perf: 'perf-regression',
  docs: 'doc-coverage',
  lint: 'lint-issues',
};

// Full detection lands in Task 9.
export const strength007SnapshotSignalMismatch: StrengthRule = {
  id: 'STRENGTH-007',
  gearPiece: 'snapshot-honesty',
  defaultSeverity: 'error',
  appliesIn: () => true,
  evaluable: () => false,
  detect(_ctx: ProjectContext): Omit<StrengthFinding, 'severity'>[] {
    return [];
  },
};
