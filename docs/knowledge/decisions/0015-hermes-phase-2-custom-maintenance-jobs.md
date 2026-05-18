---
number: 0015
title: Custom maintenance task model — user-defined tasks alongside the 21 built-ins
date: 2026-05-17
status: accepted
tier: medium
source: docs/changes/hermes-phase-2-custom-jobs/proposal.md
---

## Context

Hermes Phase 2 ("Custom Maintenance Jobs") had to deliver a way for operators
to declare recurring jobs alongside harness's built-in 21 — without forking
`BUILT_IN_TASKS`, without losing the leader-election + history + dashboard
plumbing, and without inventing a new task type. The parent meta-spec
([Hermes Adoption: 6-Phase Decomposition](../../changes/hermes-adoption/proposal.md))
named this as one of the four "killer adoption" candidates: Hermes ships a
user-extensible scheduler from day one; harness's was built-ins-only.

Three shapes were considered at brainstorming:

- **A. Merge `customTasks` into the existing `tasks` overrides map**, discriminated
  by whether the entry carries a `type` field. Single config key, but a typo in
  an override accidentally creates a new task.
- **B. A separate `customTasks: Record<string, CustomTaskDefinition>` field**,
  parallel to `tasks`. Clear visual distinction between "I'm tweaking a built-in"
  and "I'm declaring a new task." Requires two-pass resolution.
- **C. Promote `BUILT_IN_TASKS` into a default config layered with user config**.
  Maximally orthogonal but loses "fresh install ships with sane defaults that the
  operator cannot accidentally erase."

## Decision

We adopt **Option B**: a parallel `MaintenanceConfig.customTasks` field. The
scheduler's `resolveTasks()` concatenates `BUILT_IN_TASKS` (after applying
`tasks.<id>` overrides) with the entries in `customTasks` (after applying their
own `tasks.<id>` enable/schedule overrides). All four task types
(`mechanical-ai`, `pure-ai`, `report-only`, `housekeeping`) are reused;
no new types are introduced.

Custom tasks gain five new optional shape fields that built-ins do not use:

- `checkScript: { path; args?; parseStdoutJson?; timeoutMs? }` — arbitrary
  executable, mutually-exclusive with `checkCommand`. The runner parses the
  last non-empty stdout line as a JSON status envelope
  (`{status, findings?, wakeAgent?, message?, outputs?}`) and falls back to
  the existing heuristic regex otherwise.
- `contextFrom: string[]` — upstream task IDs whose latest persisted output
  is injected into the agent prompt as a `## Upstream context` block. Cycles
  are detected at config-load by `validateCustomTasks`.
- `inlineSkills: string[]` plus `inlineSkillsBudgetTokens` — skill markdown
  bodies inlined under `## Reference skills`, with a char-count budget
  that warns-then-truncates skill-granularly on overflow.
- `outputRetention: { runs?; maxAgeDays? }` — overrides the global
  `TaskOutputStore` retention bounds (default: last 50 runs, 30 days).

`RunResult.origin: RunOrigin` becomes a discriminated provenance tag set by
the entry point (cron / cli / api / chain). Operators cannot configure it.
The wire field is optional so older dashboards rendering newer payloads fall
back to `'—'`.

## Consequences

Operators gain a powerful extension surface inside the existing leader-elected
scheduler. The security boundary is schema validation + the validator's cycle
detection — sandbox isolation for `checkScript` execution remains a Phase 5
concern (the isolation-tier `BackendRouter` axis). The `TaskOutputStore`'s
on-disk JSON-per-run format is reused by the chain context-injection path,
the new `harness maintenance show` CLI surface, and (eventually) the gateway
API's `GET /api/v1/jobs/maintenance/{id}/outputs` endpoint.

The existing 21 built-ins continue to run through the legacy `CheckCommandRunner`

- `CommandExecutor` paths unchanged. Their tests pass without modification.

## Alternatives considered

- **SQLite-backed outputs** instead of per-run JSON files. Rejected because
  it adds a native binding consideration (already deferred elsewhere in
  Phase 1) and complicates the chain-context read path.
- **Replacing `checkCommand` entirely with `checkScript`**. Flag-day change
  for 21 built-ins; rejected in favor of incremental coexistence.
- **Auto-execute upstreams when downstream `contextFrom` fires**. Conflicts
  with cron semantics; explicit DAG semantics are a watch-list item (parent
  meta W3).
