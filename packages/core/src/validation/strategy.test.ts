import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { validateStrategy } from './strategy';

const VALID = `---
name: Acme Widgets
last_updated: 2026-06-02
version: 1
---

## Target problem

Widget makers ship inconsistent UIs because they lack shared primitives.

## Our approach

We sell a hosted component registry that enforces brand contracts.

## Who it's for

Mid-stage product teams (10-50 engineers).

## Key metrics

- Weekly active component installs

## Tracks

- Hosted registry: stabilize public API
`;

describe('validateStrategy', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strategy-validate-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('soft-fails (returns Ok with present:false) when STRATEGY.md is absent', async () => {
    const result = await validateStrategy(tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ present: false, valid: true });
    }
  });

  it('returns Ok when STRATEGY.md is present and valid', async () => {
    fs.writeFileSync(path.join(tmpDir, 'STRATEGY.md'), VALID);
    const result = await validateStrategy(tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ present: true, valid: true });
    }
  });

  it('returns Err with a helpful message when frontmatter is missing required fields', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'STRATEGY.md'),
      `# Acme\n\n## Target problem\n\nReal text.\n`
    );
    const result = await validateStrategy(tmpDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/frontmatter/i);
    }
  });

  it('returns Err when a required section is missing', async () => {
    const noTracks = VALID.replace(/## Tracks[\s\S]*$/, '');
    fs.writeFileSync(path.join(tmpDir, 'STRATEGY.md'), noTracks);
    const result = await validateStrategy(tmpDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/Tracks/);
    }
  });

  it('returns Err when a section body is verbatim template placeholder text', async () => {
    const placeholder = `---
name: Acme
last_updated: 2026-06-02
version: 1
---

## Target problem

<2-4 sentences. What specifically is broken in the world that this product addresses?>

## Our approach

real

## Who it's for

real

## Key metrics

- m

## Tracks

- t
`;
    fs.writeFileSync(path.join(tmpDir, 'STRATEGY.md'), placeholder);
    const result = await validateStrategy(tmpDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/placeholder/i);
    }
  });
});
