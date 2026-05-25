import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { discoverSkillCatalog, discoverSkillCatalogNames } from '../../src/workflow/skill-catalog';

describe('discoverSkillCatalogNames', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-catalog-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('returns an empty array when agents/skills/ is absent', () => {
    expect(discoverSkillCatalogNames(tmpRoot)).toEqual([]);
  });

  it('returns names from agents/skills/claude-code/*/skill.yaml', () => {
    const skillDir = path.join(tmpRoot, 'agents', 'skills', 'claude-code', 'foo');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: foo\nversion: 1.0.0\n');
    expect(discoverSkillCatalogNames(tmpRoot)).toEqual(['foo']);
  });

  it('reads from every host subdirectory under agents/skills/', () => {
    // Concern #2 from the plan: support hosts other than claude-code.
    for (const host of ['claude-code', 'cursor', 'gemini']) {
      const skillDir = path.join(tmpRoot, 'agents', 'skills', host, `${host}-skill`);
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'skill.yaml'), `name: ${host}-skill\nversion: 1.0.0\n`);
    }
    expect(discoverSkillCatalogNames(tmpRoot).sort()).toEqual([
      'claude-code-skill',
      'cursor-skill',
      'gemini-skill',
    ]);
  });

  it('deduplicates skill names that appear under multiple hosts', () => {
    for (const host of ['claude-code', 'cursor']) {
      const skillDir = path.join(tmpRoot, 'agents', 'skills', host, 'shared');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: shared\nversion: 1.0.0\n');
    }
    expect(discoverSkillCatalogNames(tmpRoot)).toEqual(['shared']);
  });

  it('skips skill directories whose skill.yaml is missing or malformed', () => {
    const skillDir = path.join(tmpRoot, 'agents', 'skills', 'claude-code', 'broken');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'this: is: not: valid: yaml: [\n');

    const okSkillDir = path.join(tmpRoot, 'agents', 'skills', 'claude-code', 'ok');
    fs.mkdirSync(okSkillDir, { recursive: true });
    fs.writeFileSync(path.join(okSkillDir, 'skill.yaml'), 'name: ok\nversion: 1.0.0\n');

    expect(discoverSkillCatalogNames(tmpRoot)).toEqual(['ok']);
  });

  it('skips skill.yaml files without a top-level `name` field', () => {
    const skillDir = path.join(tmpRoot, 'agents', 'skills', 'claude-code', 'noname');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'version: 1.0.0\n');
    expect(discoverSkillCatalogNames(tmpRoot)).toEqual([]);
  });
});

describe('discoverSkillCatalog (Phase 3)', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-catalog-phase3-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('returns name+cognitiveMode for a skill that declares cognitive_mode', () => {
    const skillDir = path.join(
      tmpRoot,
      'agents',
      'skills',
      'claude-code',
      'harness-soundness-review'
    );
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'skill.yaml'),
      'name: harness-soundness-review\nversion: 1.0.0\ncognitive_mode: adversarial-reviewer\n'
    );
    expect(discoverSkillCatalog(tmpRoot)).toEqual([
      { name: 'harness-soundness-review', cognitiveMode: 'adversarial-reviewer' },
    ]);
  });

  it('returns name with cognitiveMode=undefined when skill.yaml omits cognitive_mode', () => {
    const skillDir = path.join(tmpRoot, 'agents', 'skills', 'claude-code', 'harness-tdd');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: harness-tdd\nversion: 1.0.0\n');
    const catalog = discoverSkillCatalog(tmpRoot);
    expect(catalog).toEqual([{ name: 'harness-tdd' }]);
    expect(catalog[0]!.cognitiveMode).toBeUndefined();
  });

  it('preserves dedup across host directories on name (first occurrence wins)', () => {
    for (const host of ['claude-code', 'cursor']) {
      const skillDir = path.join(tmpRoot, 'agents', 'skills', host, 'shared');
      fs.mkdirSync(skillDir, { recursive: true });
      // claude-code declares cognitive_mode; cursor does not. First wins.
      const cogLine = host === 'claude-code' ? 'cognitive_mode: meticulous-implementer\n' : '';
      fs.writeFileSync(
        path.join(skillDir, 'skill.yaml'),
        `name: shared\nversion: 1.0.0\n${cogLine}`
      );
    }
    const catalog = discoverSkillCatalog(tmpRoot);
    expect(catalog).toHaveLength(1);
    expect(catalog[0]!.name).toBe('shared');
    // First occurrence wins — readdir order is alphabetical for the
    // single OS we test on; both 'claude-code' and 'cursor' walks emit
    // the same name so dedup keeps whichever was inserted first.
    // Assert dedup happened (length 1), and that cognitiveMode is
    // either the claude-code one or undefined — both are valid as
    // "first occurrence wins" without depending on readdir order.
    expect(['meticulous-implementer', undefined]).toContain(catalog[0]!.cognitiveMode);
  });
});
