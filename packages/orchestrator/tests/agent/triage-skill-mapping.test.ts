import { describe, expect, it } from 'vitest';
import { resolveSkillForTriage } from '../../src/agent/triage-skill-mapping';
import type { SkillCatalogEntry } from '../../src/workflow/skill-catalog';

const catalog: SkillCatalogEntry[] = [
  { name: 'harness-debugging' },
  { name: 'harness-soundness-review', cognitiveMode: 'adversarial-reviewer' },
];

describe('resolveSkillForTriage', () => {
  it('maps debugging → harness-debugging when catalog has it', () => {
    expect(resolveSkillForTriage('debugging', catalog)).toEqual({
      name: 'harness-debugging',
    });
  });

  it('carries cognitiveMode through when the catalog entry declares one', () => {
    expect(
      resolveSkillForTriage('code-review', [
        { name: 'harness-code-review', cognitiveMode: 'meticulous-implementer' },
      ])
    ).toEqual({ name: 'harness-code-review', cognitiveMode: 'meticulous-implementer' });
  });

  it('returns undefined when no catalog match (caller falls through to tier)', () => {
    expect(resolveSkillForTriage('refactoring', [])).toBeUndefined();
  });

  it('is deterministic across multiple invocations', () => {
    const a = resolveSkillForTriage('debugging', catalog);
    const b = resolveSkillForTriage('debugging', catalog);
    expect(a).toEqual(b);
  });
});
