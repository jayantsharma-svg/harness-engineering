import { z } from 'zod';

/** A single advisory finding. `.strict()` rejects unexpected keys. */
export const findingSchema = z
  .object({
    target: z.string().describe('The criterion or user-visible behavior referenced'),
    message: z.string().describe('The advisory observation'),
  })
  .strict();

/**
 * Zod schema for the LLM verdict response.
 *
 * `authority` is intentionally ABSENT: it is derived in TypeScript by
 * `deriveAcceptanceAuthority` and must never be supplied by the model. The
 * schema is `.strict()`, so an injected `authority` (or any other extra key)
 * is rejected at the parse boundary rather than silently passing through.
 */
export const acceptanceVerdictSchema = z
  .object({
    measurability: z
      .enum(['MEASURABLE', 'NOT_MEASURABLE', 'INCONCLUSIVE'])
      .describe('Whether the spec section states measurable, testable success criteria'),
    confidence: z
      .enum(['low', 'medium', 'high'])
      .describe('Confidence in the verdict; high requires a named criterion'),
    rationale: z.string().describe('Cites specific criteria/behaviors'),
    criteriaFindings: z
      .array(findingSchema)
      .describe('(a) advisory observability/testability/completeness critique'),
    coverageFindings: z
      .array(findingSchema)
      .describe('(b) advisory user-visible behaviors with no covering test'),
  })
  .strict();

export type LlmAcceptanceVerdict = z.infer<typeof acceptanceVerdictSchema>;
