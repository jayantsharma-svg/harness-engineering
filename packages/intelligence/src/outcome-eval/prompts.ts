import { z } from 'zod';

/**
 * Zod schema for the LLM verdict response.
 *
 * `authority` is intentionally ABSENT: it is derived in TypeScript by
 * `deriveAuthority` and must never be supplied by the model. The schema is
 * `.strict()` so an injected `authority` (or any other extra key) is rejected
 * at the parse boundary rather than silently passing through.
 *
 * Phase 3 will add OUTCOME_EVAL_SYSTEM_PROMPT and buildUserPrompt here.
 */
export const verdictSchema = z
  .object({
    verdict: z
      .enum(['SATISFIED', 'NOT_SATISFIED', 'INCONCLUSIVE'])
      .describe('Whether the change satisfies the judged spec section'),
    confidence: z
      .enum(['low', 'medium', 'high'])
      .describe('Confidence in the verdict; high requires a named criterion'),
    rationale: z.string().describe('Cites specific met / unmet criteria'),
    unmetCriteria: z.array(z.string()).describe('Unmet criteria; empty when SATISFIED'),
  })
  .strict();

export type LlmVerdict = z.infer<typeof verdictSchema>;
