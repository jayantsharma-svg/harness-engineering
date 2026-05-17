---
'@harness-engineering/types': minor
'@harness-engineering/core': minor
'@harness-engineering/orchestrator': minor
'@harness-engineering/cli': minor
---

Hermes Phase 2: Custom maintenance jobs + pre-launch OSV malware guard + disk hygiene

Extends `MaintenanceScheduler` beyond the 21 built-in tasks with user-defined
`customTasks` in `harness.orchestrator.md`. Adds a pre-launch OSV malware
guard via `harness mcp-guard check`, and broadens `harness cleanup-sessions`
into a per-target `.harness/` disk-hygiene sweep.

**New surfaces:**

- `CustomTaskDefinition` + `CheckScriptDefinition` + `OutputRetentionConfig` +
  `CleanupConfig` + `OsvGuardConfig` types (`@harness-engineering/types`).
- `RunResult.origin: RunOrigin` discriminated provenance tag set by the
  scheduler / CLI / API / chain entry point.
- `TaskOutputStore` persists per-run outputs to
  `.harness/maintenance/<task-id>/outputs/<iso>.json` with last-N + maxAgeDays
  retention. Default 50 runs / 30 days, overridable per-task.
- `CheckScriptRunner` spawns arbitrary executables and parses a JSON status
  envelope (`{status, findings?, wakeAgent?, message?, outputs?}`) from the
  last non-empty stdout line.
- `ContextResolver` injects `## Upstream context` (from `contextFrom`) and
  `## Reference skills` (from `inlineSkills`) into the agent prompt, with a
  warn-then-truncate token budget.
- `validateCustomTasks` runs at orchestrator boot: cycle detection across the
  merged `contextFrom` graph, per-type required-field checks, skill / script
  existence (when injected), kebab-case task IDs, no-collision with built-ins.
- `createOsvClient` (`@harness-engineering/core`) — OSV.dev REST client with
  24h disk cache (`.harness/cache/osv/`), fail-open default, `strict` mode.
- `harness mcp-guard check [--strict] [--json]` CLI subcommand. Exits 2 on any
  `MAL-*` advisory match against an `.mcp.json` `mcpServers` `npx`-launched
  package. Suitable as a `pre-mcp-launch` hook from host plugin manifests.
- `harness mcp-guard cache clear` subcommand.
- `harness cleanup-sessions --all` / `--include` / `--exclude` extension.
  Default no-flag behavior unchanged. Registered targets: `sessions` (24h),
  `cache` (7d), `maintenance` (30d), `dashboard-state` (14d), `snapshots`
  (14d), `analyzer-output` (7d).
- `harness maintenance list` / `harness maintenance show <task-id>` CLI
  subcommands.

**Backwards compatibility:** All 21 built-in tasks run through the legacy
`CheckCommandRunner` + `CommandExecutor` paths unchanged. New fields on
`TaskDefinition` / `RunResult` / `MaintenanceConfig` are optional. The
`harness maintenance run <task-id>` CLI subcommand and `/api/v1/jobs/maintenance/{id}/*`
routes are deferred to a follow-up that lands alongside the Phase 0 Gateway API.

**Knowledge artifacts:**

- ADR 0015 — Custom maintenance task model.
- `docs/knowledge/orchestrator/custom-maintenance-jobs.md`.
- `docs/knowledge/cli/pre-launch-osv-guard.md`.
