import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';

/**
 * Spec B Phase 3: an entry in the local skill catalog.
 *
 * Carries the skill's catalog `name` AND optional `cognitive_mode`
 * declaration from `skill.yaml`. Consumed by the orchestrator dispatch
 * site to construct `{ kind: 'skill', skillName, cognitiveMode }`
 * RoutingUseCases so per-skill / per-mode routing fires at dispatch.
 */
export interface SkillCatalogEntry {
  readonly name: string;
  readonly cognitiveMode?: string;
}

/**
 * Spec B Phase 3: read the local skill catalog at orchestrator startup,
 * returning each declared skill's `name` AND optional `cognitive_mode`.
 *
 * Reads from EVERY host subdirectory under `agents/skills/` (claude-code,
 * cursor, gemini, etc.). Names are deduplicated across hosts — first
 * occurrence wins (matches Phase 2 behavior for `discoverSkillCatalogNames`).
 *
 * Returns an empty array when `agents/skills/` is absent (orchestrator
 * running outside a harness project root). In that case dispatch-site
 * routing falls through to per-tier resolution, preserving today's
 * behavior (F11/N2).
 *
 * Errors reading individual skill.yaml files (malformed YAML, missing
 * `name` field, IO errors) are swallowed silently. The catalog is
 * advisory; a single broken skill.yaml should not block dispatch.
 */
export function discoverSkillCatalog(projectRoot: string): SkillCatalogEntry[] {
  const skillsRoot = path.join(projectRoot, 'agents', 'skills');
  if (!fs.existsSync(skillsRoot)) return [];

  const byName = new Map<string, SkillCatalogEntry>();

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
        const parsed = parseYaml(content) as { name?: unknown; cognitive_mode?: unknown } | null;
        if (
          parsed &&
          typeof parsed.name === 'string' &&
          parsed.name.length > 0 &&
          !byName.has(parsed.name)
        ) {
          const entry: SkillCatalogEntry =
            typeof parsed.cognitive_mode === 'string' && parsed.cognitive_mode.length > 0
              ? { name: parsed.name, cognitiveMode: parsed.cognitive_mode }
              : { name: parsed.name };
          byName.set(parsed.name, entry);
        }
      } catch {
        /* skip malformed skill.yaml */
      }
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Spec B Phase 2: read the local skill catalog at orchestrator startup
 * for warning-level routing validation (`routing.skills.<name>` where
 * `<name>` is not in the catalog).
 *
 * Spec B Phase 3: thin alias over {@link discoverSkillCatalog} — name
 * extraction preserved for the Phase 2 WorkflowLoader → validation
 * pipeline (no behavioral change for Phase 2 callers).
 */
export function discoverSkillCatalogNames(projectRoot: string): string[] {
  return discoverSkillCatalog(projectRoot).map((e) => e.name);
}
