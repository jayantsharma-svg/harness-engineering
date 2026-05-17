---
'@harness-engineering/types': minor
'@harness-engineering/orchestrator': minor
---

Hermes Phase 5 — Dispatch Hardening.

- Adds `IsolationTier` (`'none' | 'container' | 'remote-sandbox'`) as the fourth routing axis on `BackendRouter`. Configs may declare `routing.isolation.{none,container,remote-sandbox}` and tasks may issue `{ kind: 'isolation', tier }` queries.
- Adds two new backend types: `SshBackendDef` (key-based SSH agent dispatch) and `ServerlessBackendDef` with the first `'oci'` adapter (`OciServerlessBackend` — cold-starts OCI images via `docker`/`podman`).
- Adds per-task cost ceiling: `TaskDefinition.costCeiling = { maxUsd, warnAtPct? }` with abort-on-exceed. `RunResult.costUsd` records cumulative spend. `CostCeilingMonitor` (singleton, telemetry-driven) emits `'abort'` at the turn boundary when cumulative cost exceeds the ceiling; the dispatched task fails with `error === 'cost_ceiling_exceeded'`.
- ADRs `0013-dispatch-isolation-tier` and `0014-cost-ceiling-policy` document the decisions.
- Knowledge docs added under `docs/knowledge/orchestrator/` for dispatch-isolation, cost-ceiling, backends-ssh, and backends-serverless.

No breaking changes. All existing routing use cases (`tier`, `intelligence`, `maintenance`, `chat`) resolve identically; configs without `routing.isolation` fall through to `routing.default`. Tasks without `costCeiling` execute as before.
