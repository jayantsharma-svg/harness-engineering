import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { runValidate } from '../../src/commands/validate';

function makeProjectRoot(roadmapBody: string | null): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-roadmap-health-'));
  fs.writeFileSync(
    path.join(dir, 'harness.config.json'),
    JSON.stringify({ version: 1, agentsMapPath: './AGENTS.md' })
  );
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Stub\n');
  if (roadmapBody !== null) {
    fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'docs', 'roadmap.md'), roadmapBody);
  }
  return dir;
}

const FRONTMATTER = `---
project: t
version: 1
last_synced: 2026-01-01T00:00:00Z
last_manual_edit: 2026-01-01T00:00:00Z
---

# Roadmap
`;

describe('runValidate — roadmap health', () => {
  let dir: string;
  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('skips silently when docs/roadmap.md is absent', async () => {
    dir = makeProjectRoot(null);
    const result = await runValidate({
      configPath: path.join(dir, 'harness.config.json'),
      cwd: dir,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.checks.roadmapHealth).toBeUndefined();
  });

  it('fails validation when a catch-all milestone exists (RMH003)', async () => {
    dir = makeProjectRoot(
      `${FRONTMATTER}
## Backlog

### Some Feature

- **Status:** backlog
- **Spec:** —
- **Summary:** x
- **Blockers:** —
- **Plan:** —
`
    );
    const result = await runValidate({
      configPath: path.join(dir, 'harness.config.json'),
      cwd: dir,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.valid).toBe(false);
      expect(result.value.checks.roadmapHealth).toBe(false);
      const found = result.value.issues.find((i) => i.ruleId === 'RMH003');
      expect(found?.severity).toBe('error');
    }
  });

  it('surfaces unactionable planned rows as warnings without failing (RMH002)', async () => {
    dir = makeProjectRoot(
      `${FRONTMATTER}
## Craft Pipeline

### Naked Planned

- **Status:** planned
- **Spec:** —
- **Summary:** x
- **Blockers:** —
- **Plan:** —
`
    );
    const result = await runValidate({
      configPath: path.join(dir, 'harness.config.json'),
      cwd: dir,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.valid).toBe(true);
      expect(result.value.checks.roadmapHealth).toBe(true);
      const found = result.value.issues.find((i) => i.ruleId === 'RMH002');
      expect(found?.severity).toBe('warning');
    }
  });
});
