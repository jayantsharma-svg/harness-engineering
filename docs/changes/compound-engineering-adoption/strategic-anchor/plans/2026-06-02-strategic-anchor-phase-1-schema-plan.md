# Strategic Anchor Phase 1: STRATEGY.md Schema

> Define the Zod schema for `STRATEGY.md`, wire it into `harness validate`, and export types through `@harness-engineering/types`. Foundation phase: every later phase (`harness-strategy` skill, init wiring, brainstorming/roadmap-pilot grounding, knowledge-graph integration) consumes this schema.

**Date:** 2026-06-02
**Status:** Planned
**Parent spec:** [../proposal.md](../proposal.md)
**Phase:** 1 of 8

## Scope

This plan covers **only Phase 1** of the strategic-anchor proposal. Phases 2-8 (skill implementations, init wiring, brainstorming/roadmap-pilot integration, knowledge-graph integration, docs) ship in follow-up PRs — matching the proven feedback-loops phase-per-PR cadence.

### In scope

- New module `packages/core/src/strategy/` with `schema.ts`, `index.ts`, and tests
- New module `packages/core/src/validation/strategy.ts` consumed by the CLI validate command
- New shared type definitions in `packages/types/src/strategy.ts`
- Wiring `validateStrategy` into `packages/cli/src/commands/validate.ts`
- Barrel exports through `packages/core/src/index.ts` and `packages/types/src/index.ts`
- Unit tests covering schema acceptance + placeholder-rejection + happy-path validation

### Out of scope

- `harness-strategy` skill (Phase 2)
- `harness-ideate` skill (Phase 4)
- `initialize-harness-project` wiring (Phase 3)
- `harness-brainstorming` STRATEGY.md grounding (Phase 5)
- `harness-roadmap-pilot` strategy-alignment tiebreaker (Phase 6)
- `BusinessKnowledgeIngestor` strategy domain (Phase 7)
- ADRs and AGENTS.md "Strategic Anchor" section (Phase 8)
- Mutating `packages/core/src/pulse/strategy-seeder.ts` (the defensive reader remains as-is; it serves a different read path)

## Design

### Schema shape

`STRATEGY.md` is a single file at repo root with YAML frontmatter and Markdown sections:

```markdown
---
name: <product name>
last_updated: 2026-06-02
version: 1
---

# <product name> Strategy

## Target problem

<2-4 sentences. ...>

## Our approach

...

## Who it's for

...

## Key metrics

- <metric 1>: <how it's measured, where it lives>

## Tracks

- <track name>: ...

## Milestones (optional)

## Not working on (optional)

## Marketing (optional)
```

The new schema validates two things:

1. **Frontmatter** — `name` (non-empty string), `last_updated` (ISO date YYYY-MM-DD), `version` (positive integer)
2. **Section bodies** — each required section (Target problem, Our approach, Who it's for, Key metrics, Tracks) must contain ≥1 non-whitespace sentence and must NOT contain unmodified template placeholder text (e.g., the verbatim `<2-4 sentences. ...>` markers from the template).

Optional sections (Milestones, Not working on, Marketing) are not validated for body content if absent; if present, they must also pass the placeholder-rejection rule.

### Placeholder rejection

A section body fails validation if any line matches the placeholder pattern: a line beginning with `<` and ending with `>` containing the verbatim hint text from the template (`<2-4 sentences. ...>`, `<metric N>: ...`, `<track name>: ...`, etc.). Implemented as a single regex check: `/^<[^>]+>$/m` matched against trimmed lines, with the additional condition that the line is the only non-whitespace content under the heading.

The intent is to prevent "header-only completed" docs that pass without engagement. Authors filling in real content overwrite the placeholders entirely; partial fills (real content alongside leftover placeholders) also fail.

### File layout

```
packages/types/src/strategy.ts          # Shared types (StrategyFrontmatter, StrategyDoc, StrategySection)
packages/types/src/index.ts             # Add export block

packages/core/src/strategy/
  schema.ts                             # Zod schemas (StrategyFrontmatterSchema, StrategyDocSchema)
  parser.ts                             # parseStrategyDoc(raw) — splits frontmatter from body, returns StrategyDoc
  parser.test.ts                        # Parser unit tests
  schema.test.ts                        # Schema acceptance + rejection tests
  index.ts                              # Barrel export

packages/core/src/validation/strategy.ts     # validateStrategy(cwd) helper
packages/core/src/validation/strategy.test.ts
packages/core/src/validation/index.ts        # Add export

packages/cli/src/commands/validate.ts        # Wire validateStrategy into runValidate
```

### Validator behavior

`validateStrategy(cwd)`:

- Returns `Ok({ present: false, valid: true })` when `STRATEGY.md` is absent (consistent with `validatePulseConfig` soft-fail pattern — Decision 6 of the proposal).
- Returns `Ok({ present: true, valid: true })` when present and the schema accepts it.
- Returns `Err(ConfigError)` when present but the schema rejects it. The error message lists the failing field path(s) and reason (missing required section, placeholder text detected, malformed frontmatter, etc.).

### CLI integration

`validate.ts` adds a `strategyConfig` check (mirrors the existing `pulseConfig` check):

- Adds `strategyConfig?: boolean` to `ValidateResult.checks`.
- Calls `validateStrategy(cwd)` after `validatePulseConfig`.
- On `Err`, appends an issue with `check: 'strategyConfig'`, `file: 'STRATEGY.md'`, and `severity: 'error'`. Sets `result.valid = false`.

No new CLI flags. No schema changes to `harness.config.json` (the proposal places `init.strategy.declined` under `.harness/state.json`, not the project config, and that's a Phase 3 concern).

## Tasks

| #   | Task                                                                                                                             | Files                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Add shared types `StrategyFrontmatter`, `StrategyDoc`, `StrategySection` to `packages/types/src/strategy.ts` and re-export       | `packages/types/src/strategy.ts`, `packages/types/src/index.ts`                          |
| 2   | Implement `parseStrategyDoc(raw)` — splits frontmatter via `gray-matter`, extracts H2 sections by name, returns `StrategyDoc`    | `packages/core/src/strategy/parser.ts`                                                   |
| 3   | Implement `StrategyFrontmatterSchema` + `StrategyDocSchema` (Zod) with placeholder-rejection refinement                          | `packages/core/src/strategy/schema.ts`                                                   |
| 4   | Unit tests: happy path, missing required sections, placeholder-text rejection, malformed frontmatter, optional-section handling  | `packages/core/src/strategy/parser.test.ts`, `packages/core/src/strategy/schema.test.ts` |
| 5   | Barrel export from `packages/core/src/strategy/index.ts` and add `export * from './strategy'` to `packages/core/src/index.ts`    | `packages/core/src/strategy/index.ts`, `packages/core/src/index.ts`                      |
| 6   | Implement `validateStrategy(cwd): Promise<Result<StrategyValidation, ConfigError>>`                                              | `packages/core/src/validation/strategy.ts`, `packages/core/src/validation/index.ts`      |
| 7   | Test `validateStrategy` end-to-end against tmp-dir fixtures (absent, valid, invalid frontmatter, missing section, placeholders)  | `packages/core/src/validation/strategy.test.ts`                                          |
| 8   | Wire `validateStrategy` into `runValidate` (mirror pulse pattern: optional check, soft-fail when absent, hard-fail when invalid) | `packages/cli/src/commands/validate.ts`                                                  |

## Success criteria

- `pnpm --filter @harness-engineering/core test` and `pnpm --filter @harness-engineering/cli test` pass with the new tests included.
- `pnpm typecheck` succeeds across the workspace.
- `harness validate` on a repo with no STRATEGY.md continues to succeed (no regression).
- `harness validate` on a repo with a valid STRATEGY.md succeeds and reports `strategyConfig: true`.
- `harness validate` on a repo whose STRATEGY.md has missing required sections, malformed frontmatter, or untouched placeholder text fails with a clear `STRATEGY.md` issue.
- New types are reachable from `@harness-engineering/types` (importable in `packages/graph` for the future Phase 7 ingestor without crossing layer boundaries).

## Risks

- **Risk:** Placeholder regex over-triggers on legitimate content that happens to be a `<...>` reference (e.g., `<https://example.com>` or shell-style angle brackets) → **Mitigation:** Pin the placeholder rule to lines that are _the sole non-whitespace content under a heading_ AND match `^<[^>]+>$`. Real content with a `<...>` inline never trips this.
- **Risk:** Tightening the schema breaks the existing pulse `seedFromStrategy` consumer → **Mitigation:** `seedFromStrategy` is intentionally defensive and reads raw text; it never round-trips through `StrategyDocSchema`. The two paths stay decoupled. A test fixture exercises both readers against the same valid file.
- **Risk:** Optional sections grow over time → **Mitigation:** The schema accepts only the documented section names; unknown H2s are rejected (consistent with Decision 2's "schema validation rejects unknown sections; expansion requires a separate ADR").
