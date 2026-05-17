---
number: 0014
title: Per-task cost ceiling with turn-boundary abort
date: 2026-05-16
status: accepted
tier: high
source: docs/changes/hermes-phase-5-dispatch-hardening/proposal.md
---

## Context

The orchestrator dispatches maintenance tasks (`mechanical-ai`,
`pure-ai`, `report-only`, `housekeeping`) on a cron schedule. A
misbehaving model, a recursive tool-call loop, or a poorly-bounded
diagnostic task can burn arbitrarily many tokens before the existing
`turnTimeoutMs` or `maxTurns` guards kick in. Phase 0 already
records per-turn `TokenUsage` and ships a `ModelPricing` dataset, so
the data needed to compute live cumulative spend is already on hand.

Four design questions had to be answered:

1. **What is the public shape?** Raw number vs. object vs. cluster of
   sibling fields on `TaskDefinition`.
2. **Where does the abort decision live?** Inside each backend, inside
   the runner, or in a singleton monitor.
3. **When does the abort fire?** Mid-turn, or at the turn boundary.
4. **Which task types must support the ceiling?** Just the AI tasks,
   or all four.

## Decision

We chose:

1. **`costCeiling: { maxUsd: number; warnAtPct?: number }`** as an
   object, not a raw number, so future fields (per-tier overrides,
   warn-only mode) can be added without a schema-breaking change.
2. **A singleton `CostCeilingMonitor`** in
   `packages/orchestrator/src/cost/` subscribed to per-turn `TokenUsage`
   events and applying `ModelPricing` to derive cumulative spend per
   task. No backend knows the ceiling exists.
3. **Turn-boundary abort, not mid-turn cancellation.** On exceed, the
   monitor emits `'abort'`; the scheduler stops dispatching the _next_
   turn and tears the session down. The current turn finishes streaming
   on its own. This aligns with the existing turn-timeout semantics
   and is deterministic across backends, which do not uniformly support
   mid-stream cancellation.
4. **All four task types** (`mechanical-ai`, `pure-ai`, `report-only`,
   `housekeeping`) accept `costCeiling`. Defaulting to "AI-only" would
   create a foot-gun the moment a `report-only` task starts calling a
   paid API.

Additionally:

- The default ceiling is **unset** (no cap). Existing configs are
  unchanged.
- On `'abort'`, `RunResult.status = 'failure'`,
  `error = 'cost_ceiling_exceeded'`, `costUsd = <cumulative>`.
- `RunResult.costUsd` is populated on every run (defaults to 0), not
  just on aborted runs, so the dashboard can render spend per task.
- When the pricing dataset has no entry for a model, `recordTurn`
  records `0` and logs a single warning per (task, model) pair. The
  ceiling becomes a no-op for unknown-priced models rather than firing
  spurious aborts.

## Consequences

- **No backend changes required.** SSH, serverless, local, claude, etc.
  all emit the same `TokenUsage` payload; the monitor reads them
  uniformly.
- **Composable with existing limits.** Operators should pair
  `costCeiling` with `maxTurns` and `turnTimeoutMs`. The three layers
  protect against complementary failure modes (cost, loops, hangs).
- **Cumulative cost is an estimate, not an invoice.** Pricing data
  drifts; cached tokens may be billed differently across providers.
  The dashboard surfaces both spend and the model+date used to compute
  it.
- **Mid-turn runaway is bounded only by `maxTurns` × `turnTimeoutMs`.**
  Documented as a known limitation; the trade-off (deterministic abort
  vs. tight bound) is recorded here and in
  `docs/knowledge/orchestrator/cost-ceiling.md`.

## Alternatives Rejected

- **Raw number `costCeiling: 1.0`.** Simpler today, but adding
  `warnAtPct` later would break the schema.
- **Per-task monitor instance instead of singleton.** Caller has to
  remember to construct and tear down the monitor; the singleton is
  always-on, registers tasks declaratively, and reports unregistered
  task events as no-ops.
- **Inline cost check inside each backend.** Couples backends to
  pricing logic; pricing already lives in `core/src/usage`.
- **Mid-turn hard kill.** Backends do not uniformly support it; partial
  token spend would still be charged; abort would become non-deterministic.
