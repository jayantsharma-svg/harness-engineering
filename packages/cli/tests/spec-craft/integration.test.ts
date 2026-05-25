import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { runSpecCraft, critiqueSpecFile } from '../../src/spec-craft';
import { MockLlmProvider } from '../../src/shared/craft/llm/provider';

describe('runSpecCraft (integration)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-craft-int-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeFile(rel: string, content: string): void {
    const full = path.join(tmpDir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }

  it('empty project: zero findings, zero LLM calls', async () => {
    const out = await runSpecCraft({ path: tmpDir });
    expect(out.findings).toEqual([]);
    expect(out.summary.docsScanned).toBe(0);
    expect(out.summary.llmCalls.count).toBe(0);
    expect(out.summary.catalog.rubricsApplied).toHaveLength(7);
  });

  it('walks a proposal and emits findings via mock provider', async () => {
    writeFile(
      'docs/changes/feature-x/proposal.md',
      `# Feature X\n\n## Decisions\n\nVague decision.\n`
    );
    const provider = new MockLlmProvider([
      {
        promptIncludes: 'Decisions',
        response:
          '```json\n{"tier":"polish","impact":"medium","confidence":"medium","message":"vague decision row"}\n```',
      },
    ]);
    const out = await runSpecCraft({ path: tmpDir, __testProvider: provider });
    expect(out.summary.docsScanned).toBe(1);
    expect(out.summary.sectionsScanned).toBe(1);
    expect(out.findings.length).toBeGreaterThanOrEqual(1);
    expect(out.findings[0].target.section).toBe('Decisions');
  });

  it('walks an ADR alongside proposals', async () => {
    writeFile('docs/knowledge/decisions/0001-foo.md', `# ADR\n\n## Context\n\nfoo\n`);
    writeFile('docs/changes/x/proposal.md', `# Proposal\n\n## Overview\n\nbar\n`);
    const out = await runSpecCraft({ path: tmpDir });
    expect(out.summary.docsScanned).toBe(2);
  });

  it('honors maxFiles cap', async () => {
    for (let i = 0; i < 5; i++) {
      writeFile(`docs/changes/f${i}/proposal.md`, `## S\n\nbody\n`);
    }
    const out = await runSpecCraft({ path: tmpDir, maxFiles: 2 });
    expect(out.summary.docsScanned).toBe(2);
  });

  it('sections filter restricts to specific canonical names', async () => {
    writeFile(
      'docs/changes/x/proposal.md',
      `## Overview\n\nfoo\n\n## Decisions\n\nbar\n\n## Scope\n\nbaz\n`
    );
    const out = await runSpecCraft({ path: tmpDir, sections: ['decisions'] });
    // Only Decisions section is scanned; rubrics applicable to decisions
    // run, rest of doc skipped.
    expect(out.summary.sectionsScanned).toBe(1);
  });

  it('emits SpecFinding with all 3 axes present (ADR 0019)', async () => {
    writeFile('docs/changes/x/proposal.md', `## Decisions\n\nfoo\n`);
    const provider = new MockLlmProvider([
      {
        promptIncludes: 'Decisions',
        response:
          '```json\n{"tier":"foundational","impact":"large","confidence":"low","message":"x"}\n```',
      },
    ]);
    const out = await runSpecCraft({ path: tmpDir, __testProvider: provider });
    const f = out.findings.find((finding) => finding.target.section === 'Decisions');
    expect(f).toBeDefined();
    expect(f!.tier).toBe('foundational');
    expect(f!.impact).toBe('large');
    expect(f!.confidence).toBe('low');
    expect(f!.cite.rubricId).toMatch(/^SPEC-R/);
  });

  it('cross-cutting critiqueSpecFile works on a single file', async () => {
    writeFile('docs/changes/x/proposal.md', `## Decisions\n\nbody\n`);
    const provider = new MockLlmProvider([
      {
        promptIncludes: 'Decisions',
        response:
          '```json\n{"tier":"polish","impact":"small","confidence":"medium","message":"hi"}\n```',
      },
    ]);
    const findings = await critiqueSpecFile(path.join(tmpDir, 'docs/changes/x/proposal.md'), {
      provider,
    });
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });
});
