import { describe, it, expect } from 'vitest';
import { critiqueOne } from '../../src/spec-craft/phases/critique';
import { MockLlmProvider } from '../../src/shared/craft/llm/provider';
import { sharpnessRubric } from '../../src/spec-craft/catalog/rubrics/sharpness';
import type { ParsedSection } from '../../src/spec-craft/extract/sections';

const section: ParsedSection = {
  heading: 'Decisions',
  canonical: 'decisions',
  body: 'Use modern stack — scalable and clean.',
  line: 10,
  endLine: 20,
};

describe('critiqueOne', () => {
  it('parses a fenced-JSON finding and emits a SpecFinding', async () => {
    const provider = new MockLlmProvider([
      {
        promptIncludes: 'Decisions',
        response:
          '```json\n{"tier":"polish","impact":"medium","confidence":"high","message":"vague"}\n```',
      },
    ]);
    const finding = await critiqueOne({
      file: 'docs/changes/x/proposal.md',
      section,
      rubric: sharpnessRubric,
      provider,
    });
    expect(finding).not.toBeNull();
    expect(finding!.code).toBe('SPEC-R001');
    expect(finding!.tier).toBe('polish');
    expect(finding!.target.section).toBe('Decisions');
    expect(finding!.target.line).toBe(10);
    expect(finding!.cite.rubricId).toBe('SPEC-R001');
    expect(finding!.derived.priority).toBeGreaterThan(0);
  });

  it('returns null when LLM responds with `null`', async () => {
    const provider = new MockLlmProvider([
      { promptIncludes: 'Decisions', response: '```json\nnull\n```' },
    ]);
    const finding = await critiqueOne({
      file: 'docs/changes/x/proposal.md',
      section,
      rubric: sharpnessRubric,
      provider,
    });
    expect(finding).toBeNull();
  });

  it('returns null when LLM response is malformed', async () => {
    const provider = new MockLlmProvider([
      { promptIncludes: 'Decisions', response: 'no JSON here' },
    ]);
    const finding = await critiqueOne({
      file: 'docs/changes/x/proposal.md',
      section,
      rubric: sharpnessRubric,
      provider,
    });
    expect(finding).toBeNull();
  });

  it('returns null when axes are invalid', async () => {
    const provider = new MockLlmProvider([
      {
        promptIncludes: 'Decisions',
        response:
          '```json\n{"tier":"polish","impact":"medium","confidence":"sky-high","message":"bad"}\n```',
      },
    ]);
    const finding = await critiqueOne({
      file: 'docs/changes/x/proposal.md',
      section,
      rubric: sharpnessRubric,
      provider,
    });
    expect(finding).toBeNull();
  });
});
