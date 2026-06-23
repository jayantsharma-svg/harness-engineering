/** Schema version for CiReviewVerdict. Bump on breaking field changes. */
export const CI_REVIEW_VERDICT_SCHEMA_VERSION = 1 as const;

/** Runner ids that map to a verdict. 'floor-only' = heuristic floor ran, no LLM tier. */
export const CI_RUNNERS = ['claude', 'gemini', 'codex', 'cursor', 'floor-only'] as const;
export type CiRunner = (typeof CI_RUNNERS)[number];

/** Assessment values — must stay in lockstep with core ReviewAssessment (output.ts). */
export const CI_ASSESSMENTS = ['approve', 'comment', 'request-changes'] as const;
