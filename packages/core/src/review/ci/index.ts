// Phase 1: CI review contract (schema + runner-preset registry).
export {
  CiReviewVerdictSchema,
  parseCiReviewVerdict,
  CI_REVIEW_VERDICT_SCHEMA_VERSION,
  CI_RUNNERS,
  CI_ASSESSMENTS,
} from './verdict-schema';
export type { CiReviewVerdict, CiRunner } from './verdict-schema';
