import { z } from 'zod';
import { OpenAICompatibleAnalysisProvider } from '@harness-engineering/intelligence';
import type { LocalEndpointInvoke } from '@harness-engineering/core';

/**
 * Zod schema mirroring core's `ReviewFinding` so the openai-compatible provider
 * returns structured output that re-serializes into the `{ assessment, findings }`
 * shape core's `parseLocalVerdict` consumes.
 */
const FindingSchema = z.object({
  id: z.string(),
  file: z.string(),
  lineRange: z.tuple([z.number(), z.number()]),
  domain: z.enum(['compliance', 'bug', 'security', 'architecture', 'learnings']),
  severity: z.enum(['critical', 'important', 'suggestion']),
  title: z.string(),
  rationale: z.string(),
  suggestion: z.string().optional(),
  evidence: z.array(z.string()),
});

const LocalVerdictSchema = z.object({
  assessment: z.enum(['approve', 'comment', 'request-changes']),
  findings: z.array(FindingSchema),
});

/**
 * Build the `local` runner's {@link LocalEndpointInvoke} adapter.
 *
 * Core resolves `endpoint`/`model` from env and calls this with the unified diff;
 * we construct an {@link OpenAICompatibleAnalysisProvider}, ask it for a verdict
 * shaped like {@link LocalVerdictSchema}, and return the result re-serialized as a
 * JSON string so core's `parseLocalVerdict` can validate-then-derive it.
 *
 * Many local OpenAI-compatible servers (Ollama, LM Studio, vLLM) accept any API
 * key; the provider requires a non-empty string, so we default to `'local'`.
 */
export function createLocalInvoke(): LocalEndpointInvoke {
  return async ({ endpoint, model, instruction, diff }) => {
    const provider = new OpenAICompatibleAnalysisProvider({
      apiKey: process.env.HARNESS_LOCAL_API_KEY ?? 'local',
      baseUrl: endpoint,
      defaultModel: model,
    });
    const { result } = await provider.analyze({
      prompt: `${instruction}\n\n---\nDIFF UNDER REVIEW:\n${diff}`,
      responseSchema: LocalVerdictSchema,
      model,
    });
    return JSON.stringify(result);
  };
}
