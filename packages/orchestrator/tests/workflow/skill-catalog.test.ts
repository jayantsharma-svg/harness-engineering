import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { discoverSkillCatalogNames } from '../../src/workflow/skill-catalog';

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
