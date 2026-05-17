---
number: 0013
title: Isolation tier as the fourth axis on BackendRouter
date: 2026-05-16
status: accepted
tier: medium
source: docs/changes/hermes-phase-5-dispatch-hardening/proposal.md
---

## Context

Pre-Phase-5, `BackendRouter` mapped three use-case kinds to backend
names: `tier` (quick-fix / guided-change / full-exploration / diagnostic),
`intelligence` (sel / pesl), and `maintenance` / `chat` (both fall through
to `routing.default`). The router knew nothing about _where_ a backend
executes — host process, on-host container, or off-host sandbox. The
existing `ContainerBackend` decorator could wrap any backend, but the
wrapping decision lived in the agent runner, not in the routing layer.

Phase 5 introduces SSH and serverless backends, both of which run _off
the orchestrator host_. Task definitions and routing policy should be
able to request "this maintenance task needs `remote-sandbox` isolation"
without naming a specific backend, so operators can swap SSH targets or
OCI images without rewriting every task.

Three options were considered:

- **A. Declarative `isolation` on `BackendDef` + new router axis.** Each
  backend reports its native tier; routing maps a tier → backend name
  the same way `tier` and `intelligence` already work.
- **B. Synthesize the tier from `BackendDef.type`.** Hard-coded
  type-to-tier table inside the router.
- **C. Separate `executionPolicy` config.** A new top-level config block
  that maps tasks → isolation independently of routing.

## Decision

We chose **option A — declarative `isolation` on `BackendDef`, with a
new `{ kind: 'isolation'; tier }` member on `RoutingUseCase` and a new
`routing.isolation.{none,container,remote-sandbox}` map on
`RoutingConfig`**.

Concrete commitments:

1. Every `BackendDef` accepts an optional `isolation?: IsolationTier`.
   When unset, the default is `'none'` for in-process backends (local,
   anthropic, etc.) and `'remote-sandbox'` for off-host backends (ssh,
   serverless). The default lives in the operator-facing docs, not in
   the type itself — types should not encode policy.
2. `BackendRouter.resolve({ kind: 'isolation', tier })` returns
   `routing.isolation?.[tier] ?? routing.default`, matching the
   "every use case inherits default unless explicitly routed" rule
   established by SC16–SC21.
3. `BackendRouter.validateReferences()` walks
   `routing.isolation.{none,container,remote-sandbox}` and rejects
   configs whose isolation names are absent from `agent.backends`.
4. `ContainerBackend` remains a _decorator over an inner backend_,
   applied at instantiation time when the operator routes a `container`
   tier to a backend whose own `isolation` is `'none'`. It is **not**
   promoted to a `BackendDef.type` variant — doing so would force a
   recursive `inner: BackendDef` schema that is hard to author and
   validate.
5. Serverless backends are modeled as a _`BackendDef.type`_, not a
   decorator. Their execution model (cold-start per session, no
   persistent agent process) is incompatible with the decorator
   pattern.

## Consequences

- **Routing additions** — task definitions / routing policy can now
  declare `{ kind: 'isolation', tier: 'remote-sandbox' }` without naming
  a specific backend.
- **Backwards compatible** — all four existing use-case kinds (`tier`,
  `intelligence`, `maintenance`, `chat`) resolve identically. Configs
  without `routing.isolation` continue to fall through to
  `routing.default`.
- **No router knowledge of backend internals** — the router is still a
  pure name lookup; backend-specific knowledge stays in the factory and
  the decorator chain.
- **Future-proof for new isolation tiers** — adding a `vm` or
  `tee` (trusted-execution-environment) tier later is a single type
  union addition.

## Alternatives Rejected

- **B — synthesize from `type`.** Hard-codes a backend-type-to-tier map
  inside the router; new backend types require router patches. Couples
  layers that should stay independent.
- **C — separate `executionPolicy` block.** Splinters the truth across
  two config sections; operators get confused about which one wins when
  policy and routing disagree.
