import {
  CI_REVIEW_VERDICT_SCHEMA_VERSION,
  parseCiReviewVerdict,
  type CiReviewVerdict,
} from '../verdict-schema';

/** Map a claude headless code-review JSON envelope into a normalized CiReviewVerdict. */
export function parseClaudeVerdict(raw: string): CiReviewVerdict {
  const parsed = JSON.parse(raw) as {
    assessment: 'approve' | 'comment' | 'request-changes';
    findings?: unknown[];
  };
  const findings = (parsed.findings ?? []) as CiReviewVerdict['findings'];
  const blockingFindings = findings.filter((f) => f.severity === 'critical');
  return parseCiReviewVerdict({
    schemaVersion: CI_REVIEW_VERDICT_SCHEMA_VERSION,
    runner: 'claude',
    ranLlmTier: true,
    assessment: parsed.assessment,
    findings,
    blockingFindings,
    exitCode: blockingFindings.length > 0 || parsed.assessment === 'request-changes' ? 1 : 0,
    skipped: false,
  });
}
