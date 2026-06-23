import type { ProjectContext, StrengthFinding, StrengthRule } from '../types';

/**
 * STRENGTH-006 — auto-approved baseline PR.
 *
 * A workflow that auto-approves or auto-merges a PR using a PAT/token, with no
 * independent-review gate, lets the bot rubber-stamp its own changes (e.g. an
 * auto-generated baseline bump) — defeating code review.
 *
 * Implementation note: this matches RAW workflow text with regexes (no YAML
 * dependency), consistent with the SecurityScanner regex-rule precedent and the
 * spec's YAGNI stance. Caveat: a review gate located in a SEPARATE job may cause a
 * false positive; documented as a known v1 limitation (revisit in dogfood).
 */

const AUTO_STEP = /auto-?approve|auto-?merge|--auto\b|enable-pull-request-automerge/i;
const PAT_GATING = /secrets\.\w*(?:PAT|TOKEN)\w*/;
const REVIEW_SIGNAL = /required_reviewers|review.*approved|approvals?\s*:\s*[1-9]|CODEOWNERS/i;

export const strength006AutoapproveBaseline: StrengthRule = {
  id: 'STRENGTH-006',
  gearPiece: 'review-gate',
  defaultSeverity: 'error',
  appliesIn: () => true,
  evaluable: (ctx) => ctx.workflows.length > 0,
  detect(ctx: ProjectContext): Omit<StrengthFinding, 'severity'>[] {
    const findings: Omit<StrengthFinding, 'severity'>[] = [];
    for (const wf of ctx.workflows) {
      const hasAuto = AUTO_STEP.test(wf.text);
      const hasPat = PAT_GATING.test(wf.text);
      const hasReview = REVIEW_SIGNAL.test(wf.text);
      if (hasAuto && hasPat && !hasReview) {
        const lines = wf.text.split('\n');
        const idx = lines.findIndex((l) => AUTO_STEP.test(l));
        findings.push({
          id: 'STRENGTH-006',
          gearPiece: 'review-gate',
          file: wf.path,
          ...(idx >= 0 ? { line: idx + 1 } : {}),
          message:
            'Workflow auto-approves/auto-merges a PR using a token with no independent-review gate — the bot can rubber-stamp its own changes.',
          remediation:
            'Gate auto-merge behind a human review (e.g. require an approved review, required_reviewers, or CODEOWNERS) instead of a PAT alone.',
        });
      }
    }
    return findings;
  },
};
