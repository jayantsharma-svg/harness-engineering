# Hermes Phase 2: Custom Maintenance Jobs

**Parent meta-spec:** [docs/changes/hermes-adoption/proposal.md](../hermes-adoption/proposal.md)
**Roadmap item:** `hermes-phase-2-custom-jobs`
**Keywords:** maintenance-scheduler, custom-jobs, context-from, inline-skills, origin-tracking, check-script, osv-malware-guard, disk-hygiene, cleanup-sessions

## Overview

Phase 2 of the Hermes Adoption program. Extends `MaintenanceScheduler` beyond the 21 built-in tasks: arbitrary user-defined jobs declared in `harness.config.json`, per-run output persistence on disk, `context_from` chaining so a downstream job receives upstream outputs as prompt context, `inlineSkills` so skill markdown is injected into the agent prompt at runtime (distinct from `fixSkill` which dispatches the skill), an `origin` field on every `RunResult` tracking which channel/user/source triggered the run, and a `checkScript` form that replaces the `checkCommand: string[]` array with an arbitrary executable path whose stdout JSON is parsed beyond exit codes. Phase 2 also adds a pre-launch OSV malware guard on MCP/npx package configuration (catches `MAL-*` advisories before a host CLI launches the server) and expands `harness cleanup-sessions` from sessions-only to general `.harness/` disk hygiene.

The parent meta-spec ([Hermes Adoption: 6-Phase Decomposition](../hermes-adoption/proposal.md)) decomposed adoption into six phases. Phase 2 bundles **K3** (custom maintenance jobs, from I1-ext + I3+I4 + N1+N5 + P3) with **A8** (pre-launch OSV malware guard, from P2) and **A9** (cleanup-sessions expansion, from P4). The three items share an operator-trust profile — each extends a piece of existing infrastructure with user-controllable inputs that need explicit security boundaries — and ship a similar effort window. Phase 2 sits on top of Phase 0's Gateway API as a soft prerequisite: custom jobs gain an external trigger surface via `POST /api/v1/jobs/maintenance` when the gateway is present, but the core feature (CLI + cron-scheduled execution) does not require Phase 0.

### Problem

Five frictions exist today.

1. **The scheduler is built-in-only.** `BUILT_IN_TASKS` in `packages/orchestrator/src/maintenance/task-registry.ts:12` is a `readonly` constant of 21 tasks. Operators who want a recurring "run my custom lint", "audit my Stripe key rotation", "send a weekly digest of decay trends" job have no in-band path: they either fork the registry (and lose updates) or hand-roll an external cron + shell script (and lose the leader election, history, dashboard surface, telemetry, and PR-lifecycle plumbing that the scheduler already gives them).
2. **No output chaining.** When `arch-violations` finishes, its check command output dies with the run. Downstream tasks cannot read "what did the prior check find?" except via re-running the check. The `RunResult` shape (`packages/orchestrator/src/maintenance/types.ts:60`) records `findings: number` but not the textual output. This blocks any "fix the things the previous job surfaced and explain in PR body what you fixed" pattern, which is exactly the value-density spot where custom jobs are interesting.
3. **`checkCommand` is too narrow.** The current shape is `checkCommand?: string[]` — an `argv` array passed to `execFile` (orchestrator.ts:587–609 `createMaintenanceTaskRunner`). The findings count is heuristically extracted via regex `/(\d+)\s+(?:finding|issue|violation|error)/i` over stdout. This works for the 21 built-ins because they all output similar shapes, but it is brittle for user scripts whose output format harness does not control. Hermes-style `wakeAgent: false` JSON signaling is not understood; the runner cannot honor "skip the AI, the operator handled it" without changing return codes.
4. **MCP/npx packages launch unchecked.** `.mcp.json` is the standard config (parsed by `setup-mcp` at `packages/cli/src/commands/setup-mcp.ts`) that lists packages the host CLI will spawn via `npx -y <pkg>` or equivalent. Existing supply-chain primitives (`harness:supply-chain-audit`, `SEC-MCP-004` static rule that flags `npx -y` as a typosquatting vector) are correct but periodic — they fire when the operator runs an audit. There is no runtime guard between "operator clicks setup-mcp" or "host CLI is about to spawn" and "OSV.dev says this exact name has a `MAL-*` advisory active right now." Phase 2 closes that gap.
5. **`cleanup-sessions` is scoped to one directory.** `packages/cli/src/commands/cleanup-sessions.ts:45` only walks `.harness/sessions/*`. After Phases 0–1 introduced live state at `.harness/cache/`, `.harness/proposals/` (Phase 4), `.harness/maintenance/` (this phase's persistence dir), `.harness/dashboard-state/`, `.harness/snapshots/`, and various analyzer outputs, a single-purpose cleanup leaks disk over time. Operators are reporting `.harness/` directories north of 5 GB on long-running projects.

Phase 2 resolves these by extending the `TaskDefinition` shape with five new optional fields (`outputDir`, `contextFrom`, `inlineSkills`, `origin`, `checkScript`), wiring output persistence into the runner's lifecycle, generalizing `checkCommand` execution into a runner that understands JSON status lines from arbitrary executables, adding an `osv-client.ts` module + lifecycle hook used by `setup-mcp` and a new `harness mcp-guard check` CLI subcommand, and broadening `cleanup-sessions` into a per-directory rule engine.

### Goals

1. **User-defined tasks via config, no fork required.** A `maintenance.customTasks: Record<string, CustomTaskDefinition>` field in `harness.config.json` lets operators add tasks alongside the 21 built-ins. Custom tasks honor the same 4-task-type taxonomy — they extend, they do not introduce new types.
2. **Output is durable and chainable.** Every run persists its captured stdout + structured summary at `.harness/maintenance/<task-id>/outputs/<iso-timestamp>.json`. A downstream task declares `contextFrom: ['upstreamId']` and the runner injects the matching upstream's latest output into the agent's prompt context (capped at a configured token budget). A subscriber can also read `.harness/maintenance/<task-id>/outputs/` directly for ad-hoc joins outside the prompt path.
3. **Skill content can be inlined into the prompt.** A task declares `inlineSkills: ['skill-name']`; the runner resolves each skill via the existing skill registry and inlines its markdown body into the agent prompt at dispatch time. `fixSkill` (existing) means "dispatch the agent with this skill loaded as its role"; `inlineSkills` (new) means "additionally paste these skills' content as reference material." A per-task `inlineSkillsBudgetTokens` cap prevents prompt bloat. Both fields can be present on the same task.
4. **Every run is provenance-tagged.** `RunResult.origin` records the trigger source: `cron`, `cli` (operator-invoked manual run), `api:<token-name>` (Gateway API trigger, Phase 0), `chain:<upstreamTaskId>` (downstream of `contextFrom`). Telemetry and the dashboard surface this without needing to correlate logs.
5. **`checkScript` replaces `checkCommand` for custom tasks; built-ins are unchanged.** `checkScript` accepts an executable path (resolved relative to the project root or absolute) and runs it directly via `execFile`. If the executable's stdout ends in a JSON line shaped `{"status": "ok|findings|skip", "findings"?: number, "wakeAgent"?: boolean, "message"?: string, "outputs"?: object}` the runner uses that as authoritative; if not, it falls back to the existing regex-heuristic exit-code path. Built-in tasks continue to use `checkCommand: string[]` against the in-process CLI runner — no regression.
6. **Pre-launch OSV check is real-time and cached.** The orchestrator and the `setup-mcp` command both query [OSV.dev](https://osv.dev) for each MCP/npx package name declared in `.mcp.json`. A `MAL-*` advisory match aborts the operation with a clear error. Results cache in `.harness/cache/osv/<pkg>@<version>.json` with a 24-hour TTL so the check is sub-second on warm starts. The check is non-blocking when OSV is unreachable (network failures emit a warning, not an error) to avoid wedging operators behind a third-party outage.
7. **`cleanup-sessions` covers `.harness/` broadly.** The command stays backwards-compatible (`harness cleanup-sessions` with no flags continues to clean `.harness/sessions/`) but gains `--all` (every Phase-2-registered directory), `--include <dir>` and `--exclude <dir>` selectors, and a TTL override per directory in `harness.config.json` `cleanup` section.

### Non-goals

- **A new task type.** Phase 2 only extends the existing taxonomy. Adding `mechanical-mechanical` or other new types is out of scope; if a custom job's shape doesn't fit into one of the four existing types, the task is rejected at config-load with a clear error.
- **Sandbox isolation for `checkScript`.** Phase 2 runs custom scripts with the same trust level as the orchestrator process (the operator-defined them, they hold the same blast radius). Sandboxed execution is Phase 5's isolation-tier territory; this phase notes the integration point but does not implement it.
- **Multi-input chaining (DAG).** `contextFrom: [a, b, c]` accepts an array and injects all three upstreams in order, but the runner does not build a DAG: ordering is by the array's index, cycles are detected at config-load and rejected, and `contextFrom` only reads the **latest** output of each upstream (not historical traversal). A general DAG executor is parent meta watch-list (W3: D2 pipeline fusion).
- **OSV scanner for non-MCP packages.** `npm audit`-style ecosystem-wide scanning is `harness:supply-chain-audit`'s territory; Phase 2 only guards the MCP/npx surface where there is a launch lifecycle to hook into.
- **Disk hygiene for paths outside `.harness/`.** The Hermes original cleans broader cache directories; harness scopes Phase 2's cleanup to `.harness/*` only. `node_modules`, `dist`, etc. belong to the project's tooling, not harness.
- **Refactor of `BUILT_IN_TASKS` into config.** The 21 built-ins remain in code so a fresh install ships with sensible defaults that are not silently overridable. `customTasks` is a parallel field; an operator who wants to disable a built-in uses the existing `tasks.<id>.enabled: false` override.

### Scope

**In-scope:**

- `CustomTaskDefinition` type in `packages/types/src/maintenance.ts` extending the existing public `TaskOverride` shape
- New fields on `TaskDefinition` (`packages/orchestrator/src/maintenance/types.ts`): `outputDir?`, `contextFrom?`, `inlineSkills?`, `inlineSkillsBudgetTokens?`, `origin?` (computed by runner, not config), `checkScript?`
- Scheduler `resolveTasks()` merges `BUILT_IN_TASKS` with `config.maintenance.customTasks` after applying `tasks.<id>` overrides
- New `TaskOutputStore` (`packages/orchestrator/src/maintenance/output-store.ts`) handling write + read + retention for per-task outputs at `.harness/maintenance/<task-id>/outputs/`
- `TaskRunner` gains `resolveContextFrom()` and `resolveInlineSkills()` helpers; agent dispatch path consults them before composing the prompt
- New `checkScript` execution path in `CheckCommandRunner` that parses JSON status lines beyond the heuristic regex
- `origin` populated by every entry point: scheduler (`cron`), CLI manual trigger, Gateway API trigger (Phase 0), chained run
- New `osv-client.ts` (`packages/core/src/security/osv-client.ts`) + `mcp-guard` CLI subcommand (`packages/cli/src/commands/mcp-guard.ts`)
- `setup-mcp` invokes the guard before writing config; `harness doctor` (extended by Phase 3) calls the guard as a check
- Expanded `harness cleanup-sessions` with `--all`, `--include`, `--exclude`, TTL config
- `harness.config.json` schema extensions: `maintenance.customTasks`, `cleanup` (TTL-per-directory section), `osvGuard.enabled` toggle
- Knowledge artifacts under `docs/knowledge/orchestrator/custom-maintenance-jobs.md` and `docs/knowledge/cli/pre-launch-osv-guard.md`
- ADR: "Custom maintenance task model"
- AGENTS.md, CHANGELOG, plugin manifest regeneration, changeset

**Out-of-scope:**

- New dashboard pages (CRUD UI for custom tasks is `Maintenance` page extension, deferred — current dashboard already renders the resolved list)
- A new task type
- Sandboxed `checkScript` execution
- Multi-output chaining (DAG)
- OSV scanning beyond `.mcp.json`
- Disk hygiene beyond `.harness/`
- Refactor of `BUILT_IN_TASKS`

### Assumptions

- **Phase 0's Gateway API is shipped.** External-trigger via `POST /api/v1/jobs/maintenance` is the path by which `origin: 'api:*'` runs reach the scheduler. If Phase 0 has not landed, Phase 2 still ships and `origin` reduces to two values (`cron`, `cli`); the API trigger is implemented as a no-op stub that the eventual Phase 0 wires into.
- **OSV.dev's HTTPS API is the reference.** No mirror, no on-disk database, no vendored advisory feed. The single network dependency is `https://api.osv.dev/v1/query`. Per the parent meta's "telemetry by default, opt-out" invariant, `osvGuard.enabled` is `true` unless explicitly disabled.
- **Operator-defined tasks run with operator trust.** The same person edits `harness.config.json` and presses enter on `harness maintenance run`; Phase 2 does not introduce a privilege separation between "I declared this task" and "this task can read my filesystem." A loud schema validator + clear error messages on misconfiguration is the security model.
- **Skill content fits in a few KB.** Inlined skill markdown bodies are typically 1–5 KB. The `inlineSkillsBudgetTokens` cap (default: 8000) is a safety net, not a normal-case throttle. Tasks that hit the cap log a warning and truncate; they do not error.
- **`.harness/maintenance/` is owned by the orchestrator.** No external writers. The output store assumes exclusive write access; concurrent runs of the same task ID are already serialized by `processQueue` (scheduler.ts:201).

---

## Decisions Made

Seven decisions surfaced during brainstorming. Each names the alternatives considered and the reason for the choice.

### D1 — `customTasks` is a config-section, parallel to `tasks` overrides

A new top-level field `maintenance.customTasks: Record<string, CustomTaskDefinition>` in `harness.config.json` declares user tasks. It is parallel to the existing `tasks: Record<string, TaskOverride>` (which only overrides built-ins). The scheduler's `resolveTasks()` produces:

```
resolved = BUILT_IN_TASKS
  .filter(t => !tasks[t.id]?.enabled === false)
  .map(t => apply tasks[t.id] override)
  .concat(Object.entries(customTasks).map(toTaskDefinition))
```

**Alternatives rejected:**

- _Merge into `tasks`_: `tasks: Record<string, TaskDefinition | TaskOverride>` discriminated by whether the entry has a `type` field. Single field is shorter but loses the safety property that an override cannot accidentally create a new task by typo. Custom tasks should be visually distinct from overrides.
- _Move `BUILT_IN_TASKS` into a default config that gets layered_: maximally orthogonal but loses "fresh install ships with sane defaults that the operator cannot accidentally erase." Built-in defaults are a feature; pretending they're just config is a regression.

**Evidence:** Scheduler integration is `scheduler.ts:75–90 resolveTasks()` — adding a `concat` to the return value is a 4-line change. The schema validator carries the bulk of the work (cycle detection in `contextFrom`, required-field checks per task type).

### D2 — Output persistence at `.harness/maintenance/<task-id>/outputs/<iso>.json`; retention policy lives in config

Every run, regardless of task type, writes one file:

```json
{
  "taskId": "my-custom-lint",
  "startedAt": "2026-05-17T14:00:00.000Z",
  "completedAt": "2026-05-17T14:00:03.124Z",
  "status": "success",
  "findings": 3,
  "stdout": "...captured stdout...",
  "stderr": "...captured stderr...",
  "structured": { "...": "...parsed JSON status line if present..." },
  "origin": "cron",
  "context": { "upstream": "...injected upstream outputs..." }
}
```

Retention: keep last N runs per task (default N=50, configurable per task via `outputRetention.runs`), plus age-cap (default 30 days, configurable via `outputRetention.maxAgeDays`). The new `cleanup-sessions --all` (D7) sweeps both bounds.

**Alternatives rejected:**

- _SQLite_: A single `.harness/maintenance/runs.sqlite` table would be queryable and compact. Rejected because it adds a runtime native binding (already a Phase-1 risk to amortize, not double-down on), couples Phase 2 to FTS5-shaped concerns, and complicates the chain-context read path (read from SQLite vs. read a file is a needless abstraction layer for `contextFrom`).
- _JSONL append-only_: One file per task with line-per-run. Simpler to write, harder to retain (truncating the head of a JSONL file is awkward) and harder to read a single run (must seek). One file per run trades inode count for clarity; on long-running projects the inode pressure is bounded by retention.
- _Drop the structured + raw split_: One field for everything. Rejected because the prompt-context path needs the parsed structured form, the dashboard rendering wants the raw stdout, and downstream skill scripts may want either; keeping them in separate fields avoids forcing every consumer to re-parse.

**Evidence:** `RunResult` (types.ts:60) already has `findings`, `fixed`, `prUrl`. The persisted output is a strict superset plus `stdout`, `stderr`, `structured`, `origin`, `context`. The wire-shape `MaintenanceHistoryEntry` (types/src/maintenance.ts:11) is unchanged; the new output file is a sibling artifact, not a serialization of `MaintenanceHistoryEntry`.

### D3 — `contextFrom` injects upstream outputs as a synthesized prompt section

A custom task declares `contextFrom: ['arch-violations', 'dep-violations']`. When the runner composes the agent prompt (in `runMechanicalAI` or `runPureAI`), it prepends a section:

```
## Upstream context

### arch-violations (last run 2026-05-17T02:00:00.000Z, status=success, findings=4)

<stdout truncated to 2000 chars or contextBudgetTokens / contextFrom.length>

### dep-violations (last run 2026-05-17T02:00:00.000Z, status=success, findings=0)

<stdout>
```

If an upstream's latest run is older than `contextFrom.maxAgeMinutes` (default: 1440 = 24h), the entry is omitted with a `[stale: omitted]` marker rather than blocking the run. If no run exists yet, the entry is omitted with `[no prior run]`. The runner does not re-execute the upstream — `contextFrom` is read-only join.

**Alternatives rejected:**

- _Eager re-execute the upstream_: Symmetrically attractive but conflicts with cron semantics; users expect cron-scheduled tasks to run on cron, not "when something else asks." A separate `dependsOn` field could express that, but Phase 2 explicitly defers DAG semantics (Non-goal).
- _Inject as a structured tool_: Expose `getUpstream(taskId)` as an MCP-style tool the agent calls. Higher-fidelity but adds an MCP turn per upstream; for the chain-context use case (background prompt material), inlining is cheaper and simpler.
- _Inject only the parsed structured field_: Drop the raw stdout. Rejected because custom lint scripts often produce useful narrative text that a structured field can't capture, and chained agents are good at filtering.

**Evidence:** `TaskRunner.runMechanicalAI` at `task-runner.ts:161–243` composes the dispatch via `agentDispatcher.dispatch(skill, branch, backendName, cwd)`. Adding an optional `promptContext: string` parameter to `AgentDispatcher.dispatch` (or, equivalently, writing the context to a file the dispatched agent reads) is the integration point.

### D4 — `inlineSkills` resolves via the existing skill registry, with a token-budget cap that warns-then-truncates

The runner reads each declared skill name via the existing skill index (used by `harness skill list`), reads the skill's markdown body from disk, and inlines it under a `## Reference skills` header before the prompt's main directive. Order is the order declared. Hitting the budget cap stops inlining further skills and logs:

```
[maintenance] inlineSkillsBudgetTokens (8000) exhausted after 3 of 5 skills; truncated.
```

Budget accounting uses a character-count heuristic (4 chars ≈ 1 token), not a tokenizer call, since the runner doesn't need exactness and Anthropic's tokenizer requires a network call.

**Alternatives rejected:**

- _Hard error on overflow_: Heavier failure mode for a soft constraint. Custom task authors should be warned, not blocked.
- _Skip-on-overflow with no message_: Silent truncation hides the cause when an agent under-performs because reference material was missing. The warning + log line is the minimum compromise.
- _Concatenate all then truncate to budget_: Simpler but cuts skills mid-paragraph. Skill-granular cutoff preserves the integrity of what does fit.

**Evidence:** Skills live in `agents/skills/<host>/<name>/SKILL.md` (existing convention from the deleted-files in the working tree, e.g. `agents/skills/claude-code/`). The existing `harness skill` commands (`packages/cli/src/skill/`) provide the read path; the runner imports the discovery API rather than re-walking the filesystem.

### D5 — `origin` is a discriminated tag set by the entry point, not configurable

`RunResult.origin: 'cron' | 'cli' | { kind: 'api'; tokenName: string } | { kind: 'chain'; upstreamTaskId: string }`. The scheduler sets `'cron'`. Manual CLI trigger (a new `harness maintenance run <task-id>` subcommand, see below) sets `'cli'`. Gateway API (Phase 0) sets `{ kind: 'api', tokenName }` from the authenticated token. Chained run sets `{ kind: 'chain', upstreamTaskId }`. Operators cannot fake the value — there is no config field for it.

**Alternatives rejected:**

- _String-only_: `origin: string` with conventions like `"cron"` or `"api:my-bot-token"`. Marginally simpler; loses TypeScript exhaustiveness on the dashboard rendering path. Discriminated union is more code but catches drift.
- _Configurable_: Let the task declare its `origin`. Defeats the purpose — origin is a provenance signal, not a name.
- _Omit and use `triggeredBy` separately_: Splits the field; reduces telemetry value (every dashboard query joins `triggeredBy` + status).

**Evidence:** `RunResult` (`types.ts:60`) is the wire shape; adding a discriminated optional field is backwards-compatible (`origin?:` — older dashboards render `origin ?? '—'`).

### D6 — `checkScript` is preferred over `checkCommand` for custom tasks; the heuristic-regex path remains the fallback for built-ins

A custom task declares `checkScript: { path: './bin/my-check', args?: ['--strict'], parseStdoutJson?: true }`. The runner spawns it via `execFile(path, args, { cwd, timeout })`. If `parseStdoutJson` is true (default), the runner attempts `JSON.parse` on the **last** non-empty stdout line. Recognized JSON shape:

```json
{
  "status": "ok" | "findings" | "skip" | "error",
  "findings": 4,
  "wakeAgent": true,
  "message": "...",
  "outputs": { ...any structured info to persist... }
}
```

`status: 'ok'` → run completes with `status: 'no-issues'`, no AI dispatch.
`status: 'findings'` + `wakeAgent: true` → AI dispatch path (mechanical-ai), `findings` count drives PR summary.
`status: 'findings'` + `wakeAgent: false` → record but skip AI (`status: 'no-issues'`, retains findings).
`status: 'skip'` → run records as `status: 'skipped'`, `message` recorded in `RunResult.error` slot (re-used as reason field).
`status: 'error'` → `status: 'failure'`, `message` → `error`.

If the JSON line is absent or unparseable, the existing heuristic (regex extract from stdout) applies for backwards compatibility.

Built-in tasks (which use `checkCommand: string[]`) continue to run via the in-process CLI runner unchanged.

**Alternatives rejected:**

- _Replace `checkCommand` entirely_: A flag-day change for 21 built-ins. Too risky for a phase scoped to extension. The two fields coexist.
- _Make `wakeAgent` implicit from `findings > 0`_: Loses the Hermes-style explicit signal. Custom scripts often want to record findings without firing an AI dispatch (e.g., a metric-collection script).
- _Multi-line JSON / streaming_: Lossy for stdout consumption (chunking issues), and YAGNI for v1.

**Evidence:** `createMaintenanceTaskRunner` in `orchestrator.ts:587–609` is the existing implementation point; a sibling factory or a parameterized constructor adds the `checkScript` path. The wire-shape regex is preserved as a `parseHeuristic()` private helper.

### D7 — Cleanup is a per-directory rule engine with TTLs, sweeping `.harness/*`

`harness cleanup-sessions` keeps its name (backwards-compat) but gains:

```
cleanup-sessions [--dry-run]              # current behavior, sessions only
cleanup-sessions --all                    # sweep all registered dirs at their configured TTL
cleanup-sessions --include cache,outputs  # sweep specific dirs
cleanup-sessions --exclude sessions       # everything except listed
```

Registered directories (with default TTLs):

| Directory                   | Default TTL | Purpose                                    |
| --------------------------- | ----------- | ------------------------------------------ |
| `.harness/sessions/`        | 24h         | Existing behavior — unchanged              |
| `.harness/cache/`           | 7d          | Phase-0 OSV cache + Phase-1 search caches  |
| `.harness/maintenance/`     | 30d         | Phase-2 task output retention (this phase) |
| `.harness/dashboard-state/` | 14d         | Stale dashboard state from old runs        |
| `.harness/snapshots/`       | 14d         | Roadmap/state snapshots                    |
| `.harness/analyzer-output/` | 7d          | Health-check artifacts                     |

TTL is per-directory and per-entry-type. The first iteration uses mtime-based aging (consistent with existing `cleanup-sessions`). A `cleanup` section in `harness.config.json` overrides defaults per-directory.

**Alternatives rejected:**

- _Rename to `harness cleanup`_: Cleaner name; breaks existing scripts + the built-in `session-cleanup` task that runs `cleanup-sessions` as its housekeeping command. Add the new behavior to the existing command instead; rename is a watch-list item if demand emerges.
- _Time-based + size-cap combined_: Useful but adds a config knob without clear demand signal. TTL-only is enough for v1.
- _Recursive sweep of `.harness/`_: Sweeps the operator's own ad-hoc files. Phase 2 sweeps only the registered directories listed above; unknown subdirectories are preserved.

**Evidence:** `cleanup-sessions.ts:45` opens `.harness/sessions/`. Generalizing to a `(dir, ttlMs)` tuple iteration is a 30-line change. The built-in `session-cleanup` housekeeping task (task-registry.ts:172–177) continues to invoke `cleanup-sessions` with no flags, retaining its original semantics.

---

## Technical Design

This section assumes Phase 0 is shipped (Gateway API for external trigger). Each subsection lists exact files + exported names.

### File layout

```
packages/orchestrator/src/maintenance/
  scheduler.ts                  # MODIFIED: resolveTasks() concatenates customTasks
  task-registry.ts              # UNCHANGED: built-ins stay in code
  task-runner.ts                # MODIFIED: runMechanicalAI/runPureAI consult contextFrom + inlineSkills
  output-store.ts               # NEW: persist + read per-task outputs at .harness/maintenance/<id>/outputs/
  check-script-runner.ts        # NEW: spawn arbitrary executable, parse JSON status line
  context-resolver.ts           # NEW: resolveContextFrom() + resolveInlineSkills() + budget accounting
  custom-task-validator.ts      # NEW: schema validation + cycle detection for customTasks
  types.ts                      # MODIFIED: new optional fields on TaskDefinition + RunResult.origin

packages/types/src/maintenance.ts
  ...                           # MODIFIED: export CustomTaskDefinition; extend MaintenanceConfig

packages/core/src/security/
  osv-client.ts                 # NEW: query OSV.dev, cache, return MAL-* matches

packages/cli/src/commands/
  mcp-guard.ts                  # NEW: `harness mcp-guard check` subcommand
  cleanup-sessions.ts           # MODIFIED: --all / --include / --exclude + TTL-per-dir
  setup-mcp.ts                  # MODIFIED: invokes osv-client before writing config
  maintenance.ts                # NEW: `harness maintenance run <task-id>` + `list` + `show <task-id>`

packages/cli/src/config/
  schema.ts                     # MODIFIED: zod schema for customTasks / cleanup / osvGuard
  loader.ts                     # UNCHANGED (existing layered-config path is sufficient)

packages/dashboard/src/client/
  pages/maintenance/MaintenancePage.tsx   # MODIFIED: render `origin` column + new task badges

docs/knowledge/orchestrator/custom-maintenance-jobs.md   # NEW: business_process + business_concept nodes
docs/knowledge/cli/pre-launch-osv-guard.md               # NEW: business_process + business_rule nodes
docs/knowledge/decisions/custom-maintenance-task-model.md  # NEW: ADR

agents/skills/claude-code/maintenance-author-skill/SKILL.md  # NEW (optional A8 from advise_skills if surfaced)
```

### Core flows

#### Flow 1 — Custom task lifecycle, end-to-end

```
1. Operator edits harness.config.json:
   maintenance.customTasks["weekly-stripe-rotation-audit"] = {
     type: "mechanical-ai",
     description: "Audit Stripe key rotation freshness",
     schedule: "0 9 * * 1",
     branch: "harness-maint/stripe-rotation",
     checkScript: { path: "./bin/audit-stripe-rotation", parseStdoutJson: true },
     fixSkill: "harness-stripe-rotation-fix",
     inlineSkills: ["pci-dss-rotation-policy"],
     inlineSkillsBudgetTokens: 6000,
     contextFrom: ["security-findings"],
     outputRetention: { runs: 100, maxAgeDays: 90 }
   }

2. customTaskValidator.validate(config) runs at config-load:
   - schema check (required fields by type)
   - cycle detection over contextFrom graph (would reject ["a","b"] if b's contextFrom includes a)
   - skill existence check for inlineSkills
   - checkScript path existence + executable bit check
   On failure → loader returns Err with line numbers; orchestrator refuses to start.

3. MaintenanceScheduler.resolveTasks() now produces 22 (or more) tasks.

4. Cron fires at Monday 09:00. scheduler.evaluate() queues the task.

5. scheduler.processQueue() invokes onTaskDue(task), which routes to
   TaskRunner.run(task) (with origin: 'cron' applied by the caller).

6. TaskRunner.runMechanicalAI(task):
   a. checkScriptRunner.run(task.checkScript, cwd) → { passed: false, findings: 4, structured, raw }
   b. contextResolver.resolveContextFrom(task.contextFrom, outputStore) → string with prior outputs
   c. contextResolver.resolveInlineSkills(task.inlineSkills, task.inlineSkillsBudgetTokens) → string
   d. agentDispatcher.dispatch(task.fixSkill, task.branch, backend, cwd, {
        prependContext: <prompt: skills + upstream + check output>,
      })
   e. On completion, outputStore.write(taskId, runResult, captured outputs)

7. Reporter records RunResult with origin: 'cron' in dashboard history.

8. Next week, downstream task with contextFrom: ["weekly-stripe-rotation-audit"]
   sees the persisted output and threads it into its own prompt.
```

#### Flow 2 — Manual CLI trigger

```
$ harness maintenance run weekly-stripe-rotation-audit
[maintenance] Triggering task 'weekly-stripe-rotation-audit' (origin: cli)
[maintenance] Running checkScript: ./bin/audit-stripe-rotation
[maintenance] Findings: 4 (wakeAgent=true)
[maintenance] Dispatching agent: harness-stripe-rotation-fix on branch harness-maint/stripe-rotation
[maintenance] ✓ Run completed in 47s, PR opened: https://github.com/.../pull/123

$ harness maintenance show weekly-stripe-rotation-audit
Last 5 runs:
  - 2026-05-17T14:30:00Z  success  4 findings  origin: cli   PR: #123
  - 2026-05-17T09:00:00Z  success  3 findings  origin: cron  PR: #122
  ...
```

The manual-trigger path bypasses cron evaluation but reuses `TaskRunner.run()` with `origin: 'cli'` injected by the command layer.

#### Flow 3 — Pre-launch OSV guard

```
$ harness setup-mcp --add my-fancy-mcp@2.1.0
[mcp-guard] Checking my-fancy-mcp@2.1.0 against OSV.dev...
[mcp-guard] ✗ MAL-2026-0042 — Malicious package: credential exfil via postinstall
[mcp-guard]   Published: 2026-04-12  Affected versions: <=2.1.0  Source: osv.dev/list?ecosystem=npm
[mcp-guard]   Refusing to add. Use --skip-osv-guard to override (logged).

$ harness mcp-guard check
[mcp-guard] Reading .mcp.json: 4 servers
[mcp-guard]   harness@local       ✓ (skipping local entry)
[mcp-guard]   @modelcontextprotocol/server-filesystem@0.4.0  ✓ no advisories
[mcp-guard]   @notion-mcp/server@0.2.1                       ✓ no advisories
[mcp-guard]   my-fancy-mcp@2.1.0                             ✗ MAL-2026-0042
[mcp-guard] 1 of 4 servers FAILED. Exit 2.
```

Cache layer (`.harness/cache/osv/`):

- Key: `{ecosystem}-{name}@{version}.json`
- TTL: 24h (fresh after that)
- On network failure: warn, treat as "no advisory" (fail-open by default; `--strict` mode fails-closed)

Doctor (extended in Phase 3) consumes the same client and runs `mcp-guard check` as one of its checks.

#### Flow 4 — Expanded cleanup

```
$ harness cleanup-sessions
# unchanged: sweeps .harness/sessions/ at 24h TTL

$ harness cleanup-sessions --all --dry-run
[cleanup] sessions/        12 entries  3 stale (>24h)
[cleanup] cache/           48 entries  21 stale (>7d)
[cleanup] maintenance/     6 entries   0 stale (>30d)
[cleanup] dashboard-state/ 4 entries   1 stale (>14d)
[cleanup] snapshots/       9 entries   3 stale (>14d)
[cleanup] analyzer-output/ 18 entries  11 stale (>7d)
[cleanup] Would remove 39 of 97 entries. Run without --dry-run to apply.
```

### Schema additions (`packages/cli/src/config/schema.ts`)

```typescript
const CustomTaskDefinitionSchema = z
  .object({
    type: z.enum(['mechanical-ai', 'pure-ai', 'report-only', 'housekeeping']),
    description: z.string(),
    schedule: z.string(), // cron, validated by existing cron-matcher
    branch: z.string().nullable(),
    checkCommand: z.array(z.string()).optional(),
    checkScript: z
      .object({
        path: z.string(),
        args: z.array(z.string()).optional(),
        parseStdoutJson: z.boolean().default(true),
        timeoutMs: z.number().int().positive().default(120_000),
      })
      .optional(),
    fixSkill: z.string().optional(),
    inlineSkills: z.array(z.string()).optional(),
    inlineSkillsBudgetTokens: z.number().int().positive().default(8000),
    contextFrom: z.array(z.string()).optional(),
    contextFromMaxAgeMinutes: z.number().int().positive().default(1440),
    outputRetention: z
      .object({
        runs: z.number().int().positive().default(50),
        maxAgeDays: z.number().int().positive().default(30),
      })
      .optional(),
    costCeiling: TaskCostCeilingSchema.optional(),
  })
  .refine(
    // type-specific required fields
    (t) => validateByType(t),
    { message: 'task is missing required field for its type' }
  );

const MaintenanceConfigSchemaV2 = MaintenanceConfigSchema.extend({
  customTasks: z.record(z.string().regex(/^[a-z0-9-]+$/), CustomTaskDefinitionSchema).optional(),
});

const CleanupConfigSchema = z
  .object({
    defaults: z
      .object({
        sessions: z.object({ ttlHours: z.number().default(24) }).optional(),
        cache: z.object({ ttlHours: z.number().default(168) }).optional(),
        maintenance: z.object({ ttlHours: z.number().default(720) }).optional(),
        // ...other dirs
      })
      .optional(),
  })
  .optional();

const OsvGuardConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
    strict: z.boolean().default(false),
    cacheTtlHours: z.number().default(24),
  })
  .optional();
```

### Cycle detection (`custom-task-validator.ts`)

Build a directed graph `contextFrom: upstream → downstream`. DFS from each task; any back-edge is a cycle. Error message names the cycle path. Built-ins are nodes too (so a custom task with `contextFrom: ['arch-violations']` is valid; a custom task with `contextFrom: ['self']` is rejected).

### `OsvClient` (`packages/core/src/security/osv-client.ts`)

```typescript
export interface OsvClient {
  check(pkg: { ecosystem: 'npm'; name: string; version?: string }): Promise<OsvCheckResult>;
}

export interface OsvCheckResult {
  malicious: OsvAdvisory[]; // MAL-* prefix
  other: OsvAdvisory[]; // GHSA-*, CVE-*, etc. — surfaced but not blocking
  source: 'cache' | 'network' | 'fail-open';
}

export interface OsvAdvisory {
  id: string; // 'MAL-2026-0042'
  summary: string;
  published: string;
  affected: { ranges: Array<{ events: Array<{ introduced?: string; fixed?: string }> }> };
  references: Array<{ type: string; url: string }>;
}
```

Implementation uses `globalThis.fetch` (Node 20+); no new runtime dependency. Cache layer writes JSON to `.harness/cache/osv/`; lookups check `mtime` against TTL before issuing a network call.

### Knowledge artifacts

`docs/knowledge/orchestrator/custom-maintenance-jobs.md`:

- `business_process`: Custom maintenance job lifecycle (define → validate → schedule → check → execute → persist → chain)
- `business_concept`: Custom task definition, output store, context chain, inlined skill, run origin
- `business_rule`: Custom tasks inherit the 4-task-type taxonomy; cycles in `contextFrom` are rejected at config-load; `inlineSkills` budget warns-then-truncates; `origin` is set by entry point, not config
- _relationships_: Custom maintenance job chains via `contextFrom`; inlines skill content; tagged with origin

`docs/knowledge/cli/pre-launch-osv-guard.md`:

- `business_process`: Pre-launch MCP/npx package check (read .mcp.json → query OSV → cache → block-or-allow)
- `business_concept`: OSV advisory, MAL-\* prefix, advisory cache, fail-open mode
- `business_rule`: Pre-launch OSV check blocks MCP/npx packages with `MAL-*` advisories; default mode is fail-open on network failure

### ADR

`docs/knowledge/decisions/custom-maintenance-task-model.md`:

- **Context**: 21 built-in tasks cover harness's own maintenance needs; users want recurring jobs sharing the same lifecycle.
- **Decision**: Extend `TaskDefinition` with five optional fields; add a parallel config section; persist outputs to disk; honor JSON status lines from arbitrary executables.
- **Consequences**: Operators gain a powerful extension surface inside the orchestrator's existing leader-elected, history-tracked, dashboard-rendered envelope. Schema-validation is the security boundary; sandboxing is deferred to Phase 5.
- **Alternatives considered**: SQLite-backed outputs (D2); merging customTasks into tasks overrides (D1); auto-execute upstreams (D3); replacing checkCommand entirely (D6).

---

## Integration Points

### Entry Points

**New CLI commands:**

- `harness maintenance run <task-id>` — manual trigger (origin: `cli`)
- `harness maintenance list` — list resolved tasks (built-in + custom)
- `harness maintenance show <task-id>` — show last N runs with persisted outputs
- `harness mcp-guard check [--strict]` — OSV check over current `.mcp.json`
- `harness mcp-guard cache clear` — invalidate OSV cache

**Extended CLI commands:**

- `harness cleanup-sessions --all|--include|--exclude` (D7)
- `harness setup-mcp` — invokes OSV pre-launch guard before write

**New API routes (Phase 0-owned surface; Phase 2 adds):**

- `POST /api/v1/jobs/maintenance/{taskId}/trigger` — origin: `api:<token-name>`
- `GET /api/v1/jobs/maintenance/{taskId}/outputs` — paginated output store
- `GET /api/v1/jobs/maintenance/{taskId}/outputs/{runId}` — single run output

(Phase 0 declared these routes generically; Phase 2 owns the implementation for the custom-job surface.)

**New MCP tools:**

- `run_maintenance_task` (tier-1) — server-side trigger from agent skills; origin: `api:mcp-<host>`
- `read_maintenance_output` (tier-0) — read-only fetch of persisted output for chain-from-skill

**New hooks (per parent meta-spec):**

- `pre-mcp-launch` — exec'd by harness host plugin manifests before launching any MCP server. Body invokes `harness mcp-guard check --json --pkg <name>@<version>`; non-zero exit blocks the launch.

### Registrations Required

| Registry                                    | Update                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `packages/cli/src/commands/_registry.ts`    | Register `maintenance`, `mcp-guard`; cleanup-sessions remains registered                                                        |
| `packages/cli/src/mcp/server.ts`            | Register `run_maintenance_task`, `read_maintenance_output`                                                                      |
| `packages/cli/src/mcp/tool-tiers.ts`        | `run_maintenance_task` → tier-1 (writes); `read_maintenance_output` → tier-0 (read)                                             |
| `packages/orchestrator/src/gateway/routes/` | New route module `jobs/maintenance.ts` mounted under `/api/v1/`                                                                 |
| `packages/dashboard/src/client/pages/`      | `MaintenancePage.tsx` adds `origin` column + custom-task badges; reads outputs via new endpoint                                 |
| Slash command generator                     | Re-run after changes to surface `maintenance run/list/show` and `mcp-guard` in per-host manifests                               |
| Per-host plugin manifests                   | `harness-claude`, `harness-cursor`, `harness-codex`, `harness-gemini`, `harness-opencode` — add new slash commands + hook entry |
| `harness.config.json` schema                | New `maintenance.customTasks`, `cleanup`, `osvGuard` sections                                                                   |
| OpenAPI artifact (`docs/api/openapi.yaml`)  | Add the three custom-job endpoints                                                                                              |
| `agents/skills/<host>/...`                  | Optional: a `maintenance-author-skill` to guide writing custom tasks (decided after `advise_skills` review)                     |

### Documentation Updates

**Per-phase:**

- `AGENTS.md` — Custom Maintenance Jobs section: how to declare, chain, inline skills; OSV guard behavior; cleanup expansion
- `CHANGELOG.md` — `feat(maintenance): Hermes Phase 2 — custom jobs + OSV pre-launch guard + disk hygiene`
- `README.md` — Add bullet under Key Features: "User-defined maintenance jobs with output chaining and a pre-launch supply-chain guard"
- Plugin marketplace listings (`harness-claude` etc.) — surface area summary
- Changeset entry under `.changeset/`

**Knowledge graph documentation (added when phase lands):**

- `docs/knowledge/orchestrator/custom-maintenance-jobs.md`
- `docs/knowledge/cli/pre-launch-osv-guard.md`
- `docs/knowledge/orchestrator/disk-hygiene.md` (extension of an existing maintenance doc if present; else new)

**This phase spec itself:**

- Lives at `docs/changes/hermes-phase-2-custom-jobs/proposal.md`
- Linked from `docs/changes/hermes-adoption/proposal.md` (parent meta-spec)
- `docs/roadmap.md` `hermes-phase-2-custom-jobs` item's `spec` pointer migrates to this file

**ADR:**

- `docs/knowledge/decisions/custom-maintenance-task-model.md`

### Architectural Decisions

This phase warrants **one** ADR (per the parent meta-spec ledger): **Custom maintenance task model**. The OSV guard and cleanup expansion do not warrant separate ADRs — they are direct extensions of existing surfaces (`harness:supply-chain-audit` and `cleanup-sessions`) without new architectural commitments.

### Knowledge Impact

Per harness's knowledge-graph schema, all new nodes are added through the existing knowledge-pipeline (extraction → reconciliation → drift detection) — not hand-written. The following nodes are introduced:

**`business_process` nodes:**

- Custom maintenance job lifecycle — define → validate → schedule → pre-check → execute → persist → chain
- Pre-launch MCP/npx OSV check — read config → query OSV → cache → block-or-allow
- Disk hygiene sweep — per-directory TTL evaluation → list-or-remove

**`business_concept` nodes:**

- Custom task definition (parallel to built-in task definition)
- Task output store
- Context chain (the `contextFrom` graph)
- Inlined skill (the `inlineSkills` payload)
- Run origin
- OSV advisory
- MAL-\* prefix
- Advisory cache

**`business_rule` nodes:**

- Custom tasks inherit the existing 4-task-type taxonomy; no new task types are introduced
- Cycles in `contextFrom` are rejected at config-load
- `inlineSkills` budget exhaustion warns + truncates; it does not error
- `origin` is set by entry point, not declarable in config
- Pre-launch OSV check blocks MCP/npx packages with `MAL-*` advisories
- OSV guard fails open on network failure unless `--strict` is set
- `cleanup-sessions --all` sweeps only registered directories; unknown subdirectories of `.harness/` are preserved

**New relationships:**

- Custom Maintenance Job _chains via_ `contextFrom`
- Custom Maintenance Job _inlines_ Skill Content
- Custom Maintenance Job _persists to_ Task Output Store
- Run _tagged with_ Run Origin
- MCP Package _gated by_ OSV Advisory Check

---

## Success Criteria

### Level 1 — Spec-level

1. **Schema-validated config rejects invalid custom tasks at load time.** Verified by: unit tests cover all error paths (missing required field, cycle in `contextFrom`, nonexistent `inlineSkills`, nonexistent `checkScript`, conflicting `checkCommand`+`checkScript`).
2. **Built-in tasks are byte-for-byte unchanged in execution.** Verified by: existing maintenance test suite passes without modification.
3. **`origin` discriminator is exhaustive in dashboard rendering.** Verified by: TypeScript exhaustiveness check on the `Maintenance` page's switch over `RunResult.origin`.
4. **`contextFrom` cycle detection runs in O(V+E) and emits the cycle path.** Verified by: test cases for simple cycles, multi-hop cycles, and self-cycles, all with deterministic error messages.

### Level 2 — Phase-program level

1. **At least 2 user-defined custom jobs run successfully in production (dogfood).** Per parent meta-spec phase-specific observable outcome. Recorded as `origin: 'cron'` with `outputRetention` working end-to-end.
2. **OSV pre-launch guard blocks at least one synthetic malicious-package launch in CI.** Verified by: a `tests/security/osv-guard.integration.test.ts` that mocks `api.osv.dev` to return a `MAL-*` advisory; `setup-mcp` aborts with non-zero exit.
3. **`harness cleanup-sessions --all` reclaims ≥1 GB on at least one long-running dogfood project.** Recorded in the phase-completion retrospective.
4. **No regression on built-in tasks.** All 21 built-in tasks continue to run on schedule with unchanged behavior.
5. **`origin` populated on every `RunResult` for 7 consecutive days post-deploy.** Telemetry signal; verified via dashboard query.

### Level 3 — Phase-readiness gates

| Gate                                                            | Status |
| --------------------------------------------------------------- | ------ |
| `harness validate` passes                                       | ✓      |
| `harness:verification` three-tier passes                        | ✓      |
| `harness check-arch` clean                                      | ✓      |
| `harness check-deps` clean                                      | ✓      |
| Phase ADR merged to `docs/knowledge/decisions/`                 | ✓      |
| Knowledge graph nodes ingested via `harness:knowledge-pipeline` | ✓      |
| AGENTS.md updated                                               | ✓      |
| CHANGELOG entry                                                 | ✓      |
| Plugin manifests regenerated                                    | ✓      |
| OpenAPI artifact updated                                        | ✓      |
| `harness:soundness-review` passed on phase spec                 | ✓      |

### Anti-success criteria

If any of these surface, halt and re-spec:

1. **A built-in task starts failing because of `customTasks` resolution.** Indicates the merge logic is wrong; revert and re-design.
2. **OSV cache grows beyond 100 MB.** Indicates retention is broken or `mcp-guard` is being polled in a hot loop.
3. **A custom task's `contextFrom` causes the prompt to exceed Anthropic's context window without being truncated.** Indicates the budget accounting is faulty.
4. **An operator reports `cleanup-sessions --all` removed a file they considered live.** Indicates the registered-dir list is over-broad. Roll back the extra directory(ies) and recover from snapshots.

---

## Implementation Order

This sequences implementation tasks within Phase 2. Per-task estimated effort is rough; the cumulative ceiling is 5 weeks (parent meta-spec phase-scope invariant).

### Stage A — Foundation (~1 week)

1. **Schema extensions** (`packages/types/src/maintenance.ts`, `packages/cli/src/config/schema.ts`)
   - `CustomTaskDefinition` exported type
   - Zod schemas for `customTasks`, `cleanup`, `osvGuard`
   - Schema-validation unit tests covering all error paths
2. **Custom-task validator** (`custom-task-validator.ts`)
   - Cycle detection (DFS) with named error paths
   - Skill existence check via existing registry
   - Per-type required-field check
   - Tests: valid configs, all rejection cases
3. **TaskDefinition + RunResult type extensions** (`packages/orchestrator/src/maintenance/types.ts`)
   - New optional fields; backwards-compat checks
   - `origin` discriminated union

### Stage B — Output store + scheduler integration (~1 week)

4. **Output store** (`packages/orchestrator/src/maintenance/output-store.ts`)
   - Write API: `write(taskId, runResult, captured)`
   - Read API: `latest(taskId)`, `list(taskId, limit, offset)`, `get(taskId, runId)`
   - Retention enforcement on write (last-N + maxAgeDays)
   - Unit tests over an injected `fs` boundary
5. **Scheduler integration** (`scheduler.ts`)
   - `resolveTasks()` concatenates `customTasks` after applying overrides
   - `origin: 'cron'` set in `processQueue()` before `onTaskDue`
   - Integration test: custom + built-in tasks coexist
6. **Reporter integration**
   - Wire output store into the existing maintenance reporter so `recordRun()` and `outputStore.write()` are atomic

### Stage C — Context resolution + check-script runner (~1 week)

7. **`checkScriptRunner`** (`check-script-runner.ts`)
   - `execFile` with timeout; capture stdout + stderr
   - Parse last non-empty stdout line as JSON; fall back to heuristic regex
   - Tests: ok/findings/skip/error shapes; malformed JSON; timeouts; non-executable path
8. **Context resolver** (`context-resolver.ts`)
   - `resolveContextFrom(taskIds, outputStore)` returns formatted string with stale/missing markers
   - `resolveInlineSkills(skillNames, budgetTokens)` reads markdown bodies, applies budget cap, logs warning on overflow
   - Tests: budget exhaustion mid-skill; missing skill; stale upstream; empty upstream
9. **TaskRunner wiring**
   - `runMechanicalAI` + `runPureAI` accept resolved context + inlined skills and pass through to dispatch
   - `runReportOnly` + `runHousekeeping` also write outputs (no chain context)

### Stage D — CLI surface (~0.5 week)

10. **`harness maintenance` command**
    - `run <task-id>` (origin: `cli`), `list`, `show <task-id>` subcommands
    - Reuse `TaskRunner` directly
11. **`harness maintenance run --dry-run`** for custom-task authors

### Stage E — OSV guard (~1 week)

12. **`OsvClient`** (`packages/core/src/security/osv-client.ts`)
    - `check({ ecosystem, name, version })` returns `{ malicious, other, source }`
    - 24h disk cache at `.harness/cache/osv/`
    - Fail-open on network errors; `--strict` switch reverses
    - Tests with `fetch` mock; cache hit/miss
13. **`harness mcp-guard` command** (`packages/cli/src/commands/mcp-guard.ts`)
    - `check` subcommand reads `.mcp.json`, queries client, prints table, exits non-zero on malicious match
    - `cache clear` subcommand
14. **`setup-mcp` integration**
    - Before writing each package entry, call `OsvClient.check`; abort on `malicious.length > 0` unless `--skip-osv-guard`
15. **`pre-mcp-launch` hook script + plugin manifest registration**
    - Generate a shim in each host plugin manifest

### Stage F — Disk hygiene (~0.5 week)

16. **`cleanup-sessions` expansion**
    - Per-directory rule table (in code, overridable via config)
    - `--all`, `--include`, `--exclude` flags
    - Dry-run output by directory
    - Tests over a tempfs

### Stage G — Dashboard + API routes (~0.5 week)

17. **`MaintenancePage.tsx`**
    - Render `origin` column with appropriate badges
    - Surface custom-task badges (visually distinct from built-in)
    - Output store fetch via new API route (or static fixture for v1)
18. **API routes**
    - `POST /api/v1/jobs/maintenance/{taskId}/trigger` (origin: `api:<token-name>`)
    - `GET /api/v1/jobs/maintenance/{taskId}/outputs(/{runId})`

### Stage H — Knowledge artifacts + docs (~0.5 week)

19. **Knowledge docs**
    - `docs/knowledge/orchestrator/custom-maintenance-jobs.md`
    - `docs/knowledge/cli/pre-launch-osv-guard.md`
    - Run `harness:knowledge-pipeline` to ingest
20. **ADR**
    - `docs/knowledge/decisions/custom-maintenance-task-model.md`
21. **AGENTS.md, CHANGELOG, plugin manifests, OpenAPI**
    - Each in turn

### Stage I — Verification + integration + review

22. **Run `harness:verification`** (three-tier)
23. **Run `harness:integration`** (materialize knowledge, registry update)
24. **Run `harness:code-review` + `harness:pre-commit-review`**
25. **Open PR**

### Trigger conditions for re-decomposing

- Stage C grows beyond 1 week → drop `inlineSkills` from v1 and ship in a v2 follow-up. `contextFrom` and `checkScript` are the higher-value capabilities; inline skills can wait.
- Stage E's OSV cache or fail-open semantics produce false positives → switch to fail-closed only on cached entries; add an explicit `harness mcp-guard refresh` command.
- Stage G's dashboard work blocks behind missing API patterns from Phase 0 → ship the CLI surface in v1, defer dashboard rendering to a v2 follow-up after Phase 0 contracts settle.
