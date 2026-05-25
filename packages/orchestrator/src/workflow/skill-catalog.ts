import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';

/**
 * Spec B Phase 2: read the local skill catalog at orchestrator startup
 * for warning-level routing validation (`routing.skills.<name>` where
 * `<name>` is not in the catalog).
 *
 * Reads from EVERY host subdirectory under `agents/skills/` (claude-code,
 * cursor, gemini, etc.) so a skill installed under a non-claude-code host
 * does not produce a spurious warning. Names are deduplicated across
 * hosts.
 *
 * Returns an empty array when `agents/skills/` is absent (e.g.,
 * orchestrator running outside a harness project root). In that case no
 * warnings are emitted — the operator presumably knows what they are
 * doing.
 *
 * Errors reading individual skill.yaml files (malformed YAML, missing
 * `name` field, IO errors) are swallowed silently. The catalog is
 * advisory; a single broken skill.yaml should not block validation.
 */
export function discoverSkillCatalogNames(projectRoot: string): string[] {
  const skillsRoot = path.join(projectRoot, 'agents', 'skills');
  if (!fs.existsSync(skillsRoot)) return [];

  const names = new Set<string>();

  let hosts: fs.Dirent[];
  try {
    hosts = fs.readdirSync(skillsRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const host of hosts) {
    if (!host.isDirectory()) continue;
    const hostDir = path.join(skillsRoot, host.name);

    let skills: fs.Dirent[];
    try {
      skills = fs.readdirSync(hostDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const skill of skills) {
      if (!skill.isDirectory()) continue;
      const skillYamlPath = path.join(hostDir, skill.name, 'skill.yaml');
      if (!fs.existsSync(skillYamlPath)) continue;

      try {
        const content = fs.readFileSync(skillYamlPath, 'utf-8');
        const parsed = parseYaml(content) as { name?: unknown } | null;
        if (parsed && typeof parsed.name === 'string' && parsed.name.length > 0) {
          names.add(parsed.name);
        }
      } catch {
        /* skip malformed skill.yaml */
      }
    }
  }

  return [...names].sort();
}
