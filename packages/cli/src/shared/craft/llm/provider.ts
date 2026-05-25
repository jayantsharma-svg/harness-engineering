// packages/cli/src/shared/craft/llm/provider.ts
//
// Shared LLM provider adapter for the craft skill family.
//
// Extracted from packages/cli/src/design-craft/llm/provider.ts on the
// 2nd-non-design-craft-consumer trigger (spec-craft). naming-craft and
// design-craft both re-export from here so a single canonical surface
// is maintained.
//
// MVP scope:
//   - `LlmProvider` interface that craft phases consume.
//   - `MockLlmProvider` deterministic mock for tests.
//   - `getProvider({ provider, model })` returns the mock for now and
//     records a TODO for the real integration.
//
// TODO (out of MVP scope): wire `getProvider` to `packages/intelligence/`'s
// analysis-provider surface (AnthropicAnalysisProvider /
// OpenAICompatibleAnalysisProvider / ClaudeCliAnalysisProvider). The
// intelligence provider currently expects a Zod responseSchema; craft
// phases want free-form text (fenced JSON parsed by phases/critique.ts).
// Two-line bridge: either (a) extend the intelligence interface to expose
// raw text mode, or (b) wrap calls in a passthrough Zod schema.
//
// Honors ADR 0018 (LLM-judgment skill pattern):
//   - `recordCost` is a first-class method so every skill invocation
//     surfaces aggregate cost.
//   - `callText` and `callVision` are separate so vision calls can be
//     gated on `mode: 'deep'` and tracked as a distinct cost line.

/** Aggregate cost / token usage for one LLM call. */
export interface LlmCallCost {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/** Optional vision input (image bytes or URL) for `callVision`. */
export interface VisionInput {
  imageUrl?: string;
  imageBuffer?: Buffer;
  mediaType?: 'image/png' | 'image/jpeg' | 'image/webp';
}

export interface LlmProvider {
  readonly providerId: string;
  readonly model: string;

  /**
   * Free-form text completion. Returns the raw assistant text — the caller
   * is responsible for parsing fenced JSON / structured content.
   */
  callText(prompt: string, opts?: { systemPrompt?: string }): Promise<string>;

  /**
   * Vision-capable completion. Phase 1 MVP does not wire this through;
   * the mock throws so consumers in fast mode never accidentally hit it.
   */
  callVision(prompt: string, image: VisionInput, opts?: { systemPrompt?: string }): Promise<string>;

  /** Side-effect: append a cost entry. */
  recordCost(cost: LlmCallCost): void;
}

/**
 * Deterministic mock provider used by tests + as the default `getProvider`
 * return until the real intelligence-package integration lands.
 *
 * `callText` returns a fixed fenced-JSON response shaped to satisfy a
 * craft-phase parser. Tests can override the response via the
 * constructor's `responses` map (keyed by substring match on the prompt).
 *
 * The default response emits `confidence: 'low'` so the integration test
 * can assert ADR 0019's "confidence is honest" property — a mock that
 * always returned `high` would let the contract regress silently.
 */
export class MockLlmProvider implements LlmProvider {
  readonly providerId = 'mock';
  readonly model = 'mock-text-deterministic-1';

  private readonly costs: LlmCallCost[] = [];

  constructor(
    private readonly responses: Array<{
      /** Substring match against the prompt. First hit wins. */
      promptIncludes: string;
      response: string;
    }> = []
  ) {}

  async callText(prompt: string, _opts?: { systemPrompt?: string }): Promise<string> {
    this.recordCost({
      provider: this.providerId,
      model: this.model,
      inputTokens: prompt.length,
      outputTokens: 200,
      costUsd: 0,
    });

    const hit = this.responses.find((r) => prompt.includes(r.promptIncludes));
    if (hit) return hit.response;

    return [
      '```json',
      JSON.stringify(
        {
          tier: 'foundational',
          impact: 'medium',
          confidence: 'low',
          message:
            'Mock provider default response: target appears to lack a clear primary signal among its top-level interactive elements, but the code-only view leaves the actual rendered weights ambiguous. Confidence is low.',
        },
        null,
        2
      ),
      '```',
    ].join('\n');
  }

  async callVision(): Promise<string> {
    throw new Error(
      'MockLlmProvider.callVision not implemented — vision pipeline is Phase 2 work.'
    );
  }

  recordCost(cost: LlmCallCost): void {
    this.costs.push(cost);
  }

  /** Test-only — read back accumulated cost entries. */
  getCosts(): readonly LlmCallCost[] {
    return this.costs;
  }
}

/**
 * Factory for the provider used by phase implementations.
 *
 * MVP behavior: always returns a `MockLlmProvider`. The `provider`/`model`
 * args are accepted now so phase implementations can pass them through
 * unchanged when the real integration lands.
 */
export function getProvider(_opts?: { provider?: string; model?: string }): LlmProvider {
  return new MockLlmProvider();
}
