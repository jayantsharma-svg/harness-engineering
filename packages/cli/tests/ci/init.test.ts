import { describe, it, expect } from 'vitest';
import { generateCIConfig } from '../../src/commands/ci/init';

describe('generateCIConfig', () => {
  it('generates GitHub Actions workflow content', () => {
    const result = generateCIConfig({ platform: 'github' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.filename).toBe('.github/workflows/harness.yml');
    expect(result.value.content).toContain('harness ci check');
    expect(result.value.content).toContain('on:');
  });

  it('generates GitLab CI config', () => {
    const result = generateCIConfig({ platform: 'gitlab' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.filename).toBe('.gitlab-ci-harness.yml');
    expect(result.value.content).toContain('harness ci check');
  });

  it('generates generic shell script', () => {
    const result = generateCIConfig({ platform: 'generic' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.filename).toBe('harness-ci.sh');
    expect(result.value.content).toContain('#!/usr/bin/env bash');
    expect(result.value.content).toContain('harness ci check');
  });

  it('includes skip flags when checks are limited', () => {
    const result = generateCIConfig({
      platform: 'github',
      checks: ['validate', 'deps'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.content).toContain('--skip');
  });
});

describe('generateCIConfig — language', () => {
  it('emits TypeScript/default steps for github', () => {
    const result = generateCIConfig({ platform: 'github', language: 'typescript' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.content).toContain('pnpm i --frozen-lockfile');
    expect(result.value.content).toContain('pnpm build');
    expect(result.value.content).toContain('pnpm lint');
    expect(result.value.content).toContain('pnpm test');
  });

  it('emits a single fail-fast ci job with checkout, setup, install, build, lint, test, gate', () => {
    const r = generateCIConfig({ platform: 'github', language: 'typescript' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c = r.value.content;
    expect(c).toContain('actions/checkout@v4');
    expect(c).toMatch(/jobs:\s*\n\s*ci:/);
    expect(c).toContain('pnpm i --frozen-lockfile');
    expect(c).toContain('pnpm build');
    expect(c).toContain('harness ci check --json');
    // gate is the last step
    expect(c.trimEnd().endsWith('run: harness ci check --json')).toBe(true);
  });

  it('excludes any baseline-refresh or git push step', () => {
    const r = generateCIConfig({ platform: 'github' });
    if (!r.ok) return;
    expect(r.value.content).not.toMatch(/git push/);
    expect(r.value.content).not.toMatch(/refresh-baselines|baseline.*update/i);
  });
});
