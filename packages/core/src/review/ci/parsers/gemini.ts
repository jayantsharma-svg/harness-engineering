import {
  CI_REVIEW_VERDICT_SCHEMA_VERSION,
  parseCiReviewVerdict,
  type CiReviewVerdict,
} from '../verdict-schema';

const VERDICT_MAP: Record<string, CiReviewVerdict['assessment']> = {
  approve: 'approve',
  comment: 'comment',
  'request-changes': 'request-changes',
};

/** Map a gemini headless code-review envelope ({ review: { verdict, issues } }) into a CiReviewVerdict. */
export function parseGeminiVerdict(raw: string): CiReviewVerdict {
  const parsed = JSON.parse(raw) as { review?: { verdict?: string; issues?: unknown[] } };
  const assessment = VERDICT_MAP[parsed.review?.verdict ?? 'comment'] ?? 'comment';
  const findings = (parsed.review?.issues ?? []) as CiReviewVerdict['findings'];
  const blockingFindings = findings.filter((f) => f.severity === 'critical');
  return parseCiReviewVerdict({
    schemaVersion: CI_REVIEW_VERDICT_SCHEMA_VERSION,
    runner: 'gemini',
    ranLlmTier: true,
    assessment,
    findings,
    blockingFindings,
    exitCode: blockingFindings.length > 0 || assessment === 'request-changes' ? 1 : 0,
    skipped: false,
  });
}
