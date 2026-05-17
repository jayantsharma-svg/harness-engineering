# Hermes Phase 5: Dispatch Hardening

**Keywords:** hermes-phase-5, dispatch-hardening, ssh-backend, serverless-backend, isolation-tier, cost-ceiling, backend-router, abort-on-exceed

## Overview

Phase 5 of the Hermes adoption (`hermes-adoption/proposal.md`) closes the dispatch / cost-discipline gap on the orchestrator. It bundles three previously sequenced adoption decisions (A2, A3, A5) into one phase because they share the same surface area (`packages/orchestrator/src/agent/`) and the same risk class (operator-level execution boundaries + cost-runaway protection).

Today the orchestrator runs all agent backends in one of two execution environments: the host process (local) or a per-session container (`ContainerBackend` decorator). Routing is a three-axis lookup (`tier` × `intelligence` × `maintenance|chat`) and there is no first-class concept of _where_ a backend executes or _how much_ it is allowed to spend before the orchestrator pulls the cord. Phase 5 introduces:

- **SSH agent dispatch backend.** A new `ssh` backend type that spawns the agent process on a remote host over an SSH transport, with key-based auth and per-host config. Closes the realistic "single GPU box / beefy dev server" use case.
- **Serverless backend interface.** A `ServerlessBackend` abstract + one concrete OCI-image adapter. Modal-style API (cold-start a stateless image, stream events, tear down) but not Modal-coupled — community can plug Daytona, Vercel, Fly Machines, etc. behind the same interface.
- **Isolation tier as a fourth router axis.** `isolation: 'none' | 'container' | 'remote-sandbox'` becomes a first-class routing query, alongside `tier` / `intelligence` / `maintenance|chat`. Task definitions and routing policy can request the _kind_ of execution boundary they need without naming a specific backend.
- **Per-task cost ceiling with abort-on-exceed.** `costCeiling` becomes a field on `TaskDefinition` (and the resulting `RunResult` records spend against it). The orchestrator reads live cumulative spend from Phase 0 telemetry (`TokenUsage` + `ModelPricing`) and aborts dispatch when the cumulative cost for a single task exceeds its ceiling.

### Problem

Three concrete shortcomings on `main` today, all visible in `packages/orchestrator/src/agent/`:

1. **No remote dispatch.** Users with a single GPU box or beefy dev server cannot route long-running pure-AI maintenance tasks to that host. The only options are "run in the orchestrator process" or "wrap in a container on the orchestrator host". Multiple users have asked for SSH-style dispatch (Hermes Adopt-list item E3 was sourced from this signal).
2. **No serverless dispatch.** Cold-start-friendly per-task workloads (e.g., transient diagnostic runs, heavy ingestion jobs that justify isolated VMs) have no path in. The container backend is _long-lived_ (lifetime = session), not _cold-start-spawn-per-task_.
3. **No cost ceiling.** `MaintenanceScheduler` can dispatch a `pure-ai` task that, on a misbehaving model or recursive tool-call loop, can burn arbitrarily many tokens before the turn-timeout kicks in. Phase 0 already ships `TokenUsage` per turn — but there is no live aggregation that an abort path can read. This is a real autopilot cost-runaway risk surfaced in the `hermes-adoption` rationale for A5.

These three problems are independent of each other but share `packages/orchestrator/src/agent/`, the `BackendRouter`, and the dispatch lifecycle, so they ship as one phase.

### Goals

1. **First-class remote dispatch.** A documented, well-tested SSH backend with key-based auth, per-host config, and graceful cleanup on session stop.
2. **Pluggable serverless surface.** A `ServerlessBackend` interface + one concrete OCI-image adapter, structured so a third-party adapter (Daytona, Vercel, Modal proper) is a drop-in.
3. **Isolation routing axis.** `BackendRouter` gains an `isolation` query kind. Routing policy can express "this task needs `remote-sandbox`" without naming a specific backend.
4. **Hard cost cap.** `costCeiling` on `TaskDefinition` with abort-on-exceed; `RunResult.costUsd` records actual spend. All four task types (`mechanical-ai`, `pure-ai`, `report-only`, `housekeeping`) honor the cap.
5. **No regression on existing dispatch paths.** Local + container + the 7 named backends (mock/claude/anthropic/openai/gemini/local/pi) continue to work unchanged.

### Non-goals

- **A second concrete serverless adapter.** Phase 5 ships the abstract + one adapter. Daytona/Vercel/Modal-proper are watch-list (`hermes-adoption` W4).
- **Cross-host secret sync.** SSH backend assumes the remote host already has its model API keys configured locally; orchestrator does not push secrets over SSH.
- **Cluster scheduling.** Multi-host load balancing is out of scope; the SSH backend targets a single host at a time. Routing across hosts is the operator's job (named backends per host).
- **Cost-ceiling on streaming partials.** The ceiling fires at _turn boundaries_, not mid-turn. Mid-turn cancellation is best-effort via existing turn-cancellation paths.
- **Cost-ceiling beyond token spend.** Compute-time cost (e.g., GPU minutes on a remote sandbox) is _not_ modeled in Phase 5. Token spend × `ModelPricing` is the canonical metric.

### Scope

**In-scope:**

- `SshBackendDef` + `ServerlessBackendDef` discriminated-union members on `BackendDef`
- `SshBackend` class implementing `AgentBackend`
- `ServerlessBackend` abstract + first OCI adapter (`OciServerlessBackend`)
- `isolation` axis added to `RoutingUseCase` + `BackendRouter.resolve()`
- `BackendDef.isolation` declarative field (so each backend reports its native isolation tier)
- `costCeiling` on `TaskDefinition` + `costUsd` on `RunResult`
- `CostCeilingMonitor` service that subscribes to `TokenUsage` events + applies `ModelPricing` to derive live `costUsd`
- Orchestrator integration with `CostCeilingMonitor` — abort on exceed, fail the task with a typed `cost_ceiling_exceeded` error
- Knowledge docs: `docs/knowledge/orchestrator/dispatch-isolation.md`, `docs/knowledge/orchestrator/cost-ceiling.md`, `docs/knowledge/orchestrator/backends-ssh.md`, `docs/knowledge/orchestrator/backends-serverless.md`
- ADR: `docs/knowledge/decisions/0013-dispatch-isolation-tier.md`
- ADR: `docs/knowledge/decisions/0014-cost-ceiling-policy.md`

**Out-of-scope:**

- New backend types beyond SSH + OCI-image serverless (watch-list)
- Multi-host pool / load-balancing across SSH targets
- Compute-time cost modeling (token-spend only)
- Per-org cost ceilings (only per-task in Phase 5)
- Mid-turn cancellation guaranteeing instant abort (turn-boundary granularity)

---

## Decisions Made

### D1 — `BackendDef.isolation` is a declarative field; `RoutingUseCase` queries it

Every backend reports its native isolation tier (`'none' | 'container' | 'remote-sandbox'`). The router accepts a `{ kind: 'isolation', tier }` use case and resolves to the named backend in `routing.isolation[tier]` (with `routing.default` as fallback, matching the existing `tier` / `intelligence` pattern).

**Rationale:** Keeps the router pure (declarative routing table → backend name) without smuggling backend-specific knowledge into the router. The declarative `isolation` field on `BackendDef` is the source of truth; routing is just a name lookup. Adding a new backend with `isolation: 'remote-sandbox'` automatically makes it routable for that tier.

**Alternatives rejected:**

- _Synthesize isolation from `BackendDef.type`_: Couples the router to a hard-coded type→isolation map; new backend types would require router patches.
- _Use a separate "policy" config_: Splinters the truth across two files; operators get confused about which one wins.

### D2 — `ContainerBackend` is a decorator, not a routable isolation target

The existing `ContainerBackend` wraps another backend rather than being one. Phase 5 keeps that shape. `BackendDef.isolation` for the inner backend's def doesn't claim `'container'` — instead, the _router_ applies the container decorator at backend-instantiation time when `routing.isolation.container` is requested for a backend whose own isolation is `'none'`.

**Rationale:** Today's `ContainerBackend` is decorating any of the 7 base backends. We don't want to enumerate every (base × isolation) pair as a separate `BackendDef`. The decorator-at-instantiation pattern preserves current behavior.

**Alternatives rejected:**

- _Promote `ContainerBackend` to a `BackendDef` type with an `inner: BackendDef`_: Schema gets recursive; configs become harder to author and validate.

### D3 — SSH backend uses streaming `child_process`-over-ssh, not `node-ssh` library

Spawn the agent process via `ssh user@host -- agent-command`, stream the same JSON-lines protocol the local backend uses. No new library dependency.

**Rationale:** The existing local backend already speaks a streaming agent protocol over stdin/stdout. Putting `ssh` in front of it is identity-preserving — the same parser handles both. Avoids adding `node-ssh` (which would bring `ssh2` as a transitive dep) when the host's `ssh` binary already exists and is the operator's trust anchor.

**Alternatives rejected:**

- _`node-ssh` library_: Larger dep surface, separate connection lifecycle to manage, separate auth path from the operator's existing `~/.ssh/config`. Operator-side `ssh` reuses everything they already trust.

### D4 — `costCeiling` is `{ maxUsd: number; warnAtPct?: number }`, not a raw number

Field is an object so the warn threshold can be added without a schema-breaking change.

**Rationale:** Future work (cost dashboards, alerts) will want a warn level distinct from the abort level. Lifting to an object now avoids deprecating a `number` shape later.

**Alternatives rejected:**

- _Raw number_: Simpler today, but breaking change to add `warnAtPct` later.
- _Two separate fields (`costCeilingUsd` + `costCeilingWarnPct`)_: Field cluster pollution on `TaskDefinition`.

### D5 — `CostCeilingMonitor` is a singleton subscribed to telemetry, not a per-task instance

One monitor instance subscribes to the Phase 0 telemetry bus (`TelemetryEvent` of kind `agent.turn.completed`) and keeps a per-task running sum. `MaintenanceScheduler` registers a task before dispatch (`registerTask(taskId, costCeiling)`) and the monitor emits an abort signal when cumulative spend exceeds the ceiling.

**Rationale:** Decouples the abort path from any individual backend. SSH / serverless / local all emit the same turn-completion event; the monitor reads them uniformly. No backend has to know the ceiling exists.

**Alternatives rejected:**

- _Per-task monitor instance_: Caller has to remember to start/stop. Easier to leak.
- _Inline check in the runner_: Couples the runner to pricing logic; pricing is already in `core/src/usage`.

### D6 — Cost ceiling abort is _advisory at the turn boundary_

When the monitor signals abort, the orchestrator stops _dispatching the next turn_ and tears down the session. It does not interrupt the currently-streaming turn. The task is marked `failure` with `error: 'cost_ceiling_exceeded'`.

**Rationale:** Mid-turn cancellation is unreliable across backends. Turn-boundary abort is deterministic and aligns with existing turn-timeout semantics.

**Alternatives rejected:**

- _Hard kill mid-turn_: Backends don't all support it; partial token spend would still be charged.

### D7 — All four task types support `costCeiling`; default ceiling is unset (no cap)

`mechanical-ai` and `pure-ai` are the primary consumers (they dispatch agents). `report-only` and `housekeeping` _also_ accept the field for forward-compat (e.g., a future report-only task that calls a paid API). Default is `undefined` (no cap) so existing configs are unchanged.

**Rationale:** Forward-compat outweighs a slightly-larger schema. Saying "only mechanical-ai supports it" would create a foot-gun when someone adds a paid-API call to a `report-only` task.

**Alternatives rejected:**

- _Only on `mechanical-ai` / `pure-ai`_: Foot-gun for future report-only paid-API jobs.

### D8 — Serverless adapter is a backend _type_, not a decorator

`ServerlessBackendDef` is a member of the `BackendDef` discriminated union, with `adapter: 'oci'` (and future `'modal' | 'daytona' | 'vercel'`). Not modeled as a decorator over local backends because the execution model is different: serverless backends _don't_ run a persistent agent — they cold-start a stateless container per turn (or per session, depending on adapter).

**Rationale:** Decorator pattern would mislead. Serverless backends own session lifecycle differently.

**Alternatives rejected:**

- _Serverless-as-decorator_: Forces the inner backend to be cold-start-friendly; not how local/anthropic/claude work.

---

## Integration Points

This section is **required** per the harness brainstorming workflow.

### IP1 — `packages/types/src/orchestrator.ts`

- New union members: `SshBackendDef`, `ServerlessBackendDef`
- New field on every `BackendDef`: `isolation?: IsolationTier`
- New union member on `RoutingUseCase`: `{ kind: 'isolation'; tier: IsolationTier }`
- New optional field on `RoutingConfig`: `isolation?: { none?: string; container?: string; 'remote-sandbox'?: string }`
- New type: `IsolationTier = 'none' | 'container' | 'remote-sandbox'`
- New field on `TokenUsage`-adjacent shape: `CostBreakdown { inputCostUsd, outputCostUsd, cacheCostUsd, totalCostUsd }` (used by the cost ceiling)

### IP2 — `packages/orchestrator/src/agent/backends/`

- New file: `ssh.ts` — `SshBackend implements AgentBackend`
- New file: `serverless.ts` — `ServerlessBackend` abstract + `OciServerlessBackend` concrete
- Wire both into `backend-factory.ts` (`createBackend(def)` exhaustive switch)

### IP3 — `packages/orchestrator/src/agent/backend-router.ts`

- Extend `BackendRouter.resolve()` to handle `kind: 'isolation'`
- Extend `validateReferences()` to walk `routing.isolation.{none,container,remote-sandbox}`

### IP4 — `packages/orchestrator/src/maintenance/`

- `types.ts`: Add `costCeiling?: { maxUsd: number; warnAtPct?: number }` to `TaskDefinition`
- `types.ts`: Add `costUsd: number` (always present, defaulting to 0) to `RunResult`
- Wire `CostCeilingMonitor` into the scheduler dispatch path

### IP5 — `packages/orchestrator/src/cost/` (new directory)

- New file: `cost-ceiling-monitor.ts` — singleton subscribed to telemetry, tracks per-task spend, emits abort signal
- New file: `pricing.ts` — re-exports / wraps `core/src/usage/ModelPricing` for use at this layer

### IP6 — `packages/orchestrator/src/runtime/` (existing)

- Hook the abort signal from `CostCeilingMonitor` into the agent runner so it stops dispatching turns and tears down the session

### IP7 — `harness.config.json` schema (`packages/cli/src/config/`)

- Allow `agent.backends.<name>` to declare `type: 'ssh' | 'serverless'`
- Allow `agent.routing.isolation` map
- Allow `maintenance.tasks.<id>.costCeiling`

### IP8 — Knowledge artifacts (materialized by `harness:integration`)

- `docs/knowledge/orchestrator/dispatch-isolation.md` — explains the isolation tier model
- `docs/knowledge/orchestrator/cost-ceiling.md` — explains the cost ceiling pipeline
- `docs/knowledge/orchestrator/backends-ssh.md` — operator-facing SSH backend setup
- `docs/knowledge/orchestrator/backends-serverless.md` — operator-facing serverless backend setup
- `docs/knowledge/decisions/0013-dispatch-isolation-tier.md` — ADR for D1, D2, D8
- `docs/knowledge/decisions/0014-cost-ceiling-policy.md` — ADR for D4, D5, D6, D7

### IP9 — CLI surface

- `harness backends list` continues to render the new types (no new flag needed; declarative)
- `harness maintenance status` renders `costUsd` column (alongside existing columns)

### IP10 — Telemetry

- Cost ceiling consumes Phase 0 telemetry events (read-only)
- New telemetry event kind: `agent.cost.ceiling_exceeded` — emitted at abort time, consumed by webhook subscribers and dashboard `/insights/cache` widget (extended)

---

## Acceptance Criteria

Phase 5 is "done" when **all** of these are green:

### AC1 — SSH backend

- `SshBackend.startSession()` succeeds against a documented SSH target (mock + real-host integration test)
- `runTurn()` streams events matching the local-backend protocol
- `stopSession()` reliably tears down the remote process (no zombie test)
- `healthCheck()` round-trips a `true` reply over SSH

### AC2 — Serverless backend

- `ServerlessBackend` abstract compiles with no concrete deps
- `OciServerlessBackend` cold-starts an OCI image per session, runs a turn, tears down
- `OciServerlessBackend` fails gracefully on missing image / unreachable registry
- Adapter swap test: a `MockServerlessAdapter` can be subbed in via the same abstract

### AC3 — Isolation routing

- `BackendRouter.resolve({ kind: 'isolation', tier: 'remote-sandbox' })` returns the configured backend name
- Falls back to `routing.default` when the tier is not mapped
- `validateReferences()` rejects a config whose `routing.isolation.*` references a missing backend
- All existing `BackendRouter` tests pass unchanged

### AC4 — Cost ceiling

- `costCeiling: { maxUsd: 1.0 }` on a task causes the scheduler to abort dispatch when cumulative cost (across turns) exceeds $1.00
- `RunResult.costUsd` records actual cumulative cost
- `RunResult.status === 'failure'`, `error === 'cost_ceiling_exceeded'` on abort
- `CostCeilingMonitor` does not block dispatch for tasks without a ceiling
- Telemetry event `agent.cost.ceiling_exceeded` fires on abort

### AC5 — No regression

- All 7 existing backend types instantiate unchanged
- All existing `BackendRouter` use cases (tier / intelligence / maintenance / chat) resolve identically
- `MaintenanceScheduler` tasks without `costCeiling` execute identically

### AC6 — Documentation

- 4 knowledge docs land in `docs/knowledge/orchestrator/`
- 2 ADRs land in `docs/knowledge/decisions/`
- README/CHANGELOG entry

### AC7 — Layer hygiene

- `pnpm harness:validate` passes
- `pnpm test` passes
- `pnpm typecheck` passes
- No new layer-boundary violations (cost ceiling uses telemetry events, not direct imports of `core/usage`)

---

## Key Risks

| Risk                                                                  | Mitigation                                                                                         |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| SSH key management (storage, rotation, scope)                         | D3 — defer to operator's `~/.ssh/config`; document the assumption                                  |
| Serverless cold-start latency vs. responsiveness expectations         | Document the trade-off in `backends-serverless.md`; recommend for low-frequency / high-cost tasks  |
| Cost ceiling depends on accurate `ModelPricing` per backend           | Phase 0 already ships `ModelPricing`; for backends lacking pricing data, ceiling is a no-op (warn) |
| Turn-boundary granularity is insufficient for runaway tool-call loops | Document the limitation; recommend `maxTurns` + `costCeiling` together                             |
| Adoption pressure to also build Modal/Daytona adapters in this phase  | D8 — ship abstract + one (OCI) adapter; redirect other adapter requests to watch-list (W4)         |

---

## Effort

3–4 weeks of focused work. Decomposes into 4 logical chunks (see `plans/`):

1. **Plan 1: Types + router + factory** (1 week) — Schemas, router extension, factory wiring
2. **Plan 2: SSH backend** (3-5 days) — Implementation, tests, docs
3. **Plan 3: Serverless backend + OCI adapter** (1 week) — Abstract, concrete, mock adapter, tests
4. **Plan 4: Cost ceiling end-to-end** (1 week) — Monitor, pricing wire-up, scheduler integration, telemetry events, docs

---

## Phase-readiness Gates

- [ ] All AC1–AC7 green
- [ ] `harness validate` passes
- [ ] `harness:verification` passes at WIRED tier
- [ ] ADRs 0013 + 0014 merged
- [ ] CHANGELOG entry under `@harness-engineering/orchestrator` and `@harness-engineering/types`
