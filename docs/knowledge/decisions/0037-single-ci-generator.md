---
number: 0037
title: A single CI workflow generator for harness init and harness ci init
date: 2026-06-23
status: accepted
tier: medium
source: docs/changes/ci-workflow-template/proposal.md
---

## Context

Harness writes a GitHub Actions workflow in two places:

- **Scaffold time** — `harness init` provisions a new (or existing) project and should leave behind a working CI gate so the entropy that STRATEGY exists to prevent never gets a foothold.
- **On demand** — `harness ci init` regenerates or adds the workflow for a project that already exists.

If these two paths owned separate generators (for example, an `init`-time template under `packages/cli/src/templates/ci/` and the on-demand `generateCIConfig` in `packages/cli/src/commands/ci/init.ts`), they would drift: a fix to the gate step, a new language, or a trigger change would have to be made twice and would silently diverge. Drift between two "sources of truth" for the same artifact is precisely the entropy the harness standard is built to prevent — a generated CI file is no exception.

Historically the on-demand path emitted a gate-only `.github/workflows/harness.yml` that ran nothing but `harness ci check`, while scaffolding emitted nothing. The CI workflow template work (roadmap #540) unified both behind one enriched generator that builds, lints, tests (language-appropriate), and then gates.

## Decision

**Exactly one GitHub Actions generator exists** — `generateCIConfig` in `packages/cli/src/commands/ci/init.ts`. Both entry points consume it:

- `harness init` injects `generateCIConfig({ platform: 'github', ...(language && { language }) })` into the engine's rendered-files set before `engine.write()`, so the same `.github/workflows/ci.yml` is produced at scaffold time.
- `harness ci init` calls `generateCIConfig` directly, honouring `--platform` and `--language`.

There is **no parallel generator under `packages/cli/src/templates/ci/`**. The single generator:

- writes `.github/workflows/ci.yml` (the gate-only `harness.yml` filename is retired);
- emits one fail-fast `ci` job: checkout → language setup → install → build? → lint? → test → install harness CLI → `harness ci check --json` gate;
- reflects language in its steps (Python → `pytest` + `ruff`; Go → `go test ./...` + `golangci-lint`; Rust → `cargo test` + `clippy`; Java → `mvn -B verify`; TS/default → `pnpm` build/lint/test), falling back to TS defaults for unknown languages;
- installs the CLI (`npm install -g @harness-engineering/cli`) immediately before the gate so the gate runs on any GitHub-hosted runner regardless of project language (GitHub-hosted `ubuntu-latest` ships Node+npm);
- contains **no** auto-baseline-update or `git push` step;
- is classified as a harness-managed file (`HARNESS_CONFIG_FILES` in `packages/cli/src/templates/engine.ts`) so existing-project mode emits it, while the engine's non-overwrite path preserves a hand-tuned `ci.yml` that already exists.

GitLab and generic generators are unchanged and remain simple; the `language` option does not affect their output.

## Consequences

**Positive:**

- One place to fix the gate, add a language, or change triggers — scaffold-time and on-demand output cannot diverge.
- New-project and existing-project flows reach the same `ci.yml`; existing hand-tuned workflows are never clobbered.
- Future language enrichment (more linters, matrix builds) lands in `stepsForLanguage` once and propagates to both callers.

**Negative:**

- The single generator now carries per-language branching it did not before, making `ci/init.ts` larger. Mitigated by the small, table-like `stepsForLanguage` switch.

**Neutral:**

- The shared `CIInitOptions` type in `packages/types/src/ci.ts` does not carry `language`; the generator uses an inline option type. If a typed caller ever needs it, add it then (YAGNI now).

## Alternatives considered

- **Separate scaffold-time template + on-demand generator.** Rejected — guarantees drift between two artifacts that must stay identical; contradicts the anti-entropy purpose of the harness standard.
- **Keep the gate-only `harness.yml` and add a richer `ci.yml` alongside.** Rejected — two GitHub workflows competing as the "harness gate" is exactly the ambiguity D1 removes; the gate-only filename is retired.
- **Detect the platform inside `scaffoldProject`.** Deferred — scaffolding defaults to `github` per D5; `harness ci init` retains `--platform`/`detectPlatform`. Wiring detection into init is YAGNI until a non-GitHub scaffold target appears.

## Implementation

- Generator: `generateCIConfig` + `stepsForLanguage` + `generateGitHubActions` in `packages/cli/src/commands/ci/init.ts`.
- Scaffold wiring: `scaffoldProject` in `packages/cli/src/commands/init.ts` injects the generated file into the engine's rendered-files set before `engine.write()`.
- Harness-managed classification: `.github/workflows/ci.yml` added to `HARNESS_CONFIG_FILES` in `packages/cli/src/templates/engine.ts`; non-overwrite path protects an existing file.
- Tests: `packages/cli/tests/ci/init.test.ts` (per-language + structure + CLI-install-before-gate), `packages/cli/tests/integration/init.test.ts` (existing-project emit, non-overwrite, language-driven steps).

## Links

- Roadmap #540 — CI workflow template (this work).
- Roadmap #525 — no auto-baseline step in generated CI (the generator omits any baseline-refresh/`git push`).
- Roadmap #541 — required-review enforcement (separate concern; not part of this generator).
