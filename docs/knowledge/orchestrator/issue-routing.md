---
type: business_process
domain: orchestrator
tags:
  [
    routing,
    triage,
    scope-tier,
    escalation,
    model-router,
    multi-backend,
    routing-config,
    per-skill,
    per-cognitive-mode,
    fallback-chain,
    routing-resolution,
  ]
---

# Issue Routing

The orchestrator uses a two-stage routing system to decide how each issue should be handled: triage (skill selection) then model routing (backend selection).

## Scope Tier Detection

Each issue is assigned a scope tier based on artifact presence or explicit labels:

- **quick-fix** — Simple, well-scoped changes
- **guided-change** — Moderate complexity with existing spec or plan
- **full-exploration** — Exploratory, always requires human review
- **diagnostic** — Troubleshooting with lower retry budget

Label overrides (e.g., `scope:quick-fix`) take precedence over automatic detection.

## Triage Rules

Skill selection is based on issue signals:

- Rollback detected -> debugging (high confidence)
- Security prefix/paths/labels -> security-review (high)
- Docs-only changes -> docs (high)
- Failing tests -> debugging (medium)
- Migration paths detected -> planning (high)
- Small fix (<=3 files) -> code-review (high)
- Large fix (>3 files) -> planning (medium)
- Feature -> planning (medium)
- Refactor -> refactoring (medium)
- Default -> code-review (low)

## Escalation Rules

- **full-exploration** always escalates to human
- **guided-change** routes locally unless concern signals (security, migration, etc.) are present, which trigger human escalation
- **quick-fix** and **diagnostic** dispatch to whichever backend `routing['quick-fix']` and `routing.diagnostic` name (defaulting to `routing.default` when unset). The legacy synthesized name is `local`; modern configs name backends explicitly.

## Backend Routing

Once a tier is permitted to dispatch (i.e. it's not blocked by `escalation.alwaysHuman` and is allowed by `escalation.autoExecute`), `agent.routing` selects _which_ backend handles it. Routing is orthogonal to escalation:

- **Escalation** answers "should this tier dispatch at all?" — gates on `alwaysHuman`, `autoExecute`, `signalGated`, and concern signals from the intelligence pipeline.
- **Routing** answers "where does this tier dispatch when permitted?" — selects an `agent.backends.<name>` entry by use case.

The routing map is keyed by use case across five axes:

- **`default`** (required) — fallback for any unmapped use case
- **Per-tier**: `quick-fix`, `guided-change`, `full-exploration`, `diagnostic` — scope-tier dispatch
- **Per-intelligence-layer**: `intelligence.sel`, `intelligence.pesl` — analysis-provider selection
- **Per-isolation-tier**: `isolation.<tier>` — isolation-tier dispatch
- **Per-skill** (Spec B): `skills.<skill-name>` — pins a specific skill to a backend regardless of scope tier
- **Per-cognitive-mode** (Spec B): `modes.<cognitive-mode>` — pins all skills of a given cognitive mode to a backend

Maintenance and dashboard chat both use `routing.default`. Unknown routing keys are validation errors.

### Resolution Order

The orchestrator's `BackendRouter.resolve()` walks routing sources in a deterministic order; the first match wins:

1. Invocation override (e.g., `--backend <name>` from CLI)
2. Per-skill (`routing.skills.<name>`)
3. Per-cognitive-mode (`routing.modes.<mode>`)
4. Per-tier / per-intelligence-layer / per-isolation / maintenance / chat (pre-Spec-B)
5. `routing.default`

See [Routing Resolution](./routing-resolution.md) for the full walk and the `RoutingDecision` telemetry shape.

### Fallback Chains

Every routing value accepts a single backend name (`'claude-opus'`) or an ordered fallback chain (`['local-fast', 'claude-sonnet']`). The resolver walks the chain in declared order and picks the first entry whose backend exists in `agent.backends`. Scalar form is byte-compatible with pre-Spec-B configs.

## See also

- [Routing Resolution](./routing-resolution.md) — full resolution chain + decision telemetry (Spec B)
- [Local Model Resolution](./local-model-resolution.md) — LMLM (Spec A) auto-populates models within each backend; routing references backend names
- [Multi-Backend Routing guide](../../guides/multi-backend-routing.md) — operator-facing schema
- [Routing Trace guide](../../guides/routing-trace.md) — debugging routing decisions
- [ADR 0005: Named backends map](../decisions/0005-named-backends-map.md)
- [ADR 0029: Per-skill and per-cognitive-mode routing axes](../decisions/0029-per-skill-and-per-mode-routing-axes.md)
