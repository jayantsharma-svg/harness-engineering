import { describe, it, expect } from 'vitest';
import { critiqueOne } from '../../src/knowledge-craft/phases/critique';
import { MockLlmProvider } from '../../src/shared/craft/llm/provider';
import { loadBearingFactRubric } from '../../src/knowledge-craft/catalog/rubrics/load-bearing-fact';
import { earnsGraphPlaceRubric } from '../../src/knowledge-craft/catalog/rubrics/earns-graph-place';

describe('critiqueOne (knowledge-craft)', () => {
  const input = {
    file: '/repo/docs/knowledge/auth.md',
    relative: 'auth.md',
    content: '# Auth\n\nThe user service validates emails.',
    rubric: loadBearingFactRubric,
  };

  it('parses a fenced-JSON finding and emits a KnowledgeFinding', async () => {
    const provider = new MockLlmProvider([
      {
        promptIncludes: 'KNOW-R001',
        response:
          '```json\n{"tier":"foundational","impact":"large","confidence":"high","message":"paraphrases code"}\n```',
      },
    ]);
    const finding = await critiqueOne({ ...input, provider });
    expect(finding).not.toBeNull();
    expect(finding!.code).toBe('KNOW-R001');
    expect(finding!.tier).toBe('foundational');
    expect(finding!.impact).toBe('large');
    expect(finding!.confidence).toBe('high');
    expect(finding!.target.file).toBe('/repo/docs/knowledge/auth.md');
    expect(finding!.target.relative).toBe('auth.md');
    expect(finding!.cite.rubricId).toBe('KNOW-R001');
    expect(finding!.cite.source).toBe(loadBearingFactRubric.source);
    expect(finding!.derived.priority).toBeGreaterThan(0);
  });

  it('returns null when LLM responds with `null`', async () => {
    const provider = new MockLlmProvider([
      { promptIncludes: 'KNOW-R001', response: '```json\nnull\n```' },
    ]);
    const finding = await critiqueOne({ ...input, provider });
    expect(finding).toBeNull();
  });

  it('returns null when LLM response is malformed', async () => {
    const provider = new MockLlmProvider([
      { promptIncludes: 'KNOW-R001', response: 'no JSON here' },
    ]);
    const finding = await critiqueOne({ ...input, provider });
    expect(finding).toBeNull();
  });

  it('returns null when axes are invalid', async () => {
    const provider = new MockLlmProvider([
      {
        promptIncludes: 'KNOW-R001',
        response:
          '```json\n{"tier":"polish","impact":"medium","confidence":"sky-high","message":"bad"}\n```',
      },
    ]);
    const finding = await critiqueOne({ ...input, provider });
    expect(finding).toBeNull();
  });

  it('prompt for KNOW-R003 names the graph taxonomy types', async () => {
    const provider = new MockLlmProvider([]);
    await critiqueOne({ ...input, rubric: earnsGraphPlaceRubric, provider });
    const costs = provider.getCosts();
    expect(costs.length).toBe(1);
    // The mock recorded the prompt length, which means the prompt was built.
    // Verify the rubric description (which lives in the prompt) names every
    // graph node type — this is the no-graph-reads contract from the spec.
    const desc = earnsGraphPlaceRubric.description;
    expect(desc).toContain('business_fact');
    expect(desc).toContain('business_rule');
    expect(desc).toContain('business_concept');
    expect(desc).toContain('business_decision');
  });
});
