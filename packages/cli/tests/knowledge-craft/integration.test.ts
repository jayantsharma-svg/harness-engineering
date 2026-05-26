import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { runKnowledgeCraft, critiqueKnowledgeFile } from '../../src/knowledge-craft';
import { MockLlmProvider } from '../../src/shared/craft/llm/provider';

describe('runKnowledgeCraft (integration)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-craft-int-'));
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
    const out = await runKnowledgeCraft({ path: tmpDir });
    expect(out.findings).toEqual([]);
    expect(out.summary.counts.filesScanned).toBe(0);
    expect(out.summary.llmCalls.count).toBe(0);
    expect(out.summary.catalog.rubricsApplied).toHaveLength(7);
  });

  it('walks an entry and emits findings via mock provider', async () => {
    writeFile(
      'docs/knowledge/auth/email-validator.md',
      '# Email Validator\n\nThe user service validates emails via the EmailValidator class.\n'
    );
    const provider = new MockLlmProvider([
      {
        promptIncludes: 'KNOW-R001',
        response:
          '```json\n{"tier":"foundational","impact":"large","confidence":"high","message":"paraphrase"}\n```',
      },
    ]);
    const out = await runKnowledgeCraft({ path: tmpDir, __testProvider: provider });
    expect(out.summary.counts.filesScanned).toBe(1);
    expect(out.findings.length).toBeGreaterThanOrEqual(1);
    const knowR001 = out.findings.find((f) => f.code === 'KNOW-R001');
    expect(knowR001).toBeDefined();
    expect(knowR001!.target.relative).toBe('auth/email-validator.md');
  });

  it('hard-excludes decisions/ even if other files exist there', async () => {
    writeFile('docs/knowledge/decisions/0001-pick-postgres.md', '# ADR\n\n## Context\n\nfoo\n');
    writeFile('docs/knowledge/regular-entry.md', '# Regular\n\nload-bearing fact.\n');
    const out = await runKnowledgeCraft({ path: tmpDir });
    expect(out.summary.counts.filesScanned).toBe(1);
    // No finding should have a target.relative under decisions/
    for (const f of out.findings) {
      expect(f.target.relative).not.toContain('decisions');
    }
  });

  it('honors maxFiles cap', async () => {
    for (let i = 0; i < 5; i++) {
      writeFile(`docs/knowledge/entry-${i}.md`, `# Entry ${i}\n\nbody\n`);
    }
    const out = await runKnowledgeCraft({ path: tmpDir, maxFiles: 2 });
    expect(out.summary.counts.filesScanned).toBe(2);
  });

  it('honors excludeDirs additional argument', async () => {
    writeFile('docs/knowledge/drafts/wip.md', '# WIP\n');
    writeFile('docs/knowledge/canonical.md', '# Canonical\n');
    const out = await runKnowledgeCraft({ path: tmpDir, excludeDirs: ['drafts'] });
    expect(out.summary.counts.filesScanned).toBe(1);
  });

  it('emits KnowledgeFinding with all 3 axes present (ADR 0019)', async () => {
    writeFile('docs/knowledge/entry.md', '# Entry\n\nbody.\n');
    const provider = new MockLlmProvider([
      {
        promptIncludes: 'KNOW-R001',
        response:
          '```json\n{"tier":"foundational","impact":"large","confidence":"low","message":"x"}\n```',
      },
    ]);
    const out = await runKnowledgeCraft({ path: tmpDir, __testProvider: provider });
    const f = out.findings.find((finding) => finding.code === 'KNOW-R001');
    expect(f).toBeDefined();
    expect(f!.tier).toBe('foundational');
    expect(f!.impact).toBe('large');
    expect(f!.confidence).toBe('low');
    expect(f!.cite.rubricId).toMatch(/^KNOW-R/);
  });

  it('reports cost telemetry from the provider', async () => {
    writeFile('docs/knowledge/entry.md', '# Entry\n\nbody.\n');
    const out = await runKnowledgeCraft({ path: tmpDir });
    // 7 rubrics * 1 file = 7 LLM calls
    expect(out.summary.llmCalls.count).toBe(7);
    expect(out.summary.llmCalls.provider).toBe('mock');
  });

  it('cross-cutting critiqueKnowledgeFile works on a single file', async () => {
    writeFile('docs/knowledge/entry.md', '# Entry\n\nbody.\n');
    const provider = new MockLlmProvider([
      {
        promptIncludes: 'KNOW-R001',
        response:
          '```json\n{"tier":"polish","impact":"small","confidence":"medium","message":"hi"}\n```',
      },
    ]);
    const findings = await critiqueKnowledgeFile(path.join(tmpDir, 'docs/knowledge/entry.md'), {
      provider,
    });
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it('files override scopes critique to caller-supplied list', async () => {
    writeFile('docs/knowledge/a.md', '# A\n');
    writeFile('docs/knowledge/b.md', '# B\n');
    writeFile('docs/knowledge/c.md', '# C\n');
    const out = await runKnowledgeCraft({
      path: tmpDir,
      files: [path.join(tmpDir, 'docs/knowledge/a.md')],
    });
    expect(out.summary.counts.filesScanned).toBe(1);
  });
});
