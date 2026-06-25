# Live Work-in-Flight Kanban for Parallel/Autopilot Runs

**Keywords:** dashboard, orchestrator, kanban, work-in-flight, parallel, autopilot, worktree, blockers, dependency-edges, lanes, websocket

## Overview

The harness dashboard today surfaces _retrospective_ health signals (signals, decay, traceability, roadmap) and an Orchestrator monitor that lists running agents as a flat, expandable feed. What it does not surface is **work-in-flight as a board**: which tasks are queued, which agents own which worktree, what is blocked and why, and how in-flight tasks depend on one another.

This feature adds a **Live Work-in-Flight Kanban** — a new dashboard system page (`/s/kanban`, "Work in Flight") that organizes orchestrator/parallel-coordinator state into kanban lanes. Each card is a task; lanes are derived from the orchestrator's existing run-attempt lifecycle. Cards show the owning agent (backend), the worktree path, elapsed time, the current phase, blocker reasons, and dependency edges to other in-flight tasks.

The critical scope insight, confirmed by reading the code: **the data is already on the wire.** `Orchestrator.getSnapshot()` (`packages/orchestrator/src/orchestrator.ts:1962`) serializes the full `RunningEntry` for each running agent — including `workspacePath` (worktree), `attempt`, and the full `Issue` with `blockedBy` dependency references — and broadcasts it via the WebSocket `state_change` event and `GET /api/v1/state` (`packages/orchestrator/src/server/http.ts:610`). The dashboard client already consumes this stream via `useOrchestratorSocket` (`packages/dashboard/src/client/hooks/useOrchestratorSocket.ts`). The client TypeScript types simply under-declare the payload. **This is surfacing existing state, not new infrastructure** — there are zero orchestrator/server changes.

### Goals

1. A new "Work in Flight" board groups in-flight orchestrator tasks into kanban lanes (Queued, In Progress, Blocked, Done) in real time, driven by the existing WebSocket snapshot stream.
2. Each task card shows: owning agent (backend), worktree path, current phase, elapsed time, token/turn counts, and — when blocked — the blocker reason.
3. Dependency edges (`issue.blockedBy`) are surfaced per-card; when a blocker is also present on the board, the two cards are visually cross-linked on hover.
4. Zero server-side changes: the board reuses the existing `useOrchestratorSocket` stream; only client types widen to match the wire payload the orchestrator already sends.

### Non-goals

- A force-directed / SVG dependency-graph layout engine drawing routed edges between cards (the existing `DependencyGraph.tsx` is a separate, heavier surface; deferred as future work). Dependency edges in v1 are card-level annotations + cross-highlight.
- Interactive control of the orchestrator from the board (start/stop/reassign agents) — this is a read-only observability surface.
- New orchestrator endpoints, new WebSocket message types, or new server-side state. The board derives lanes client-side from the snapshot already broadcast.
- Persisting board history or completed-task detail beyond what the snapshot already carries (`completed` is a bounded list of issue IDs).
- Replacing the existing Orchestrator monitor page; the kanban complements it (board view vs. feed view).

## Decisions

| Decision                      | Choice                                                                                         | Rationale                                                                                                                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data source & transport       | Reuse `useOrchestratorSocket` WebSocket `state_change` snapshot — no new endpoint              | The full `RunningEntry` (worktree, attempt, issue+blockedBy) is already serialized by `getSnapshot()` and broadcast. Adding an endpoint would duplicate lane logic and contradict "surface existing state." |
| Server changes                | None                                                                                           | The wire payload already carries every field the board needs; only the client `RunningAgent`/`OrchestratorSnapshot` types are widened to match.                                                             |
| Lane model                    | Four lanes — Queued, In Progress, Blocked, Done — derived by a pure function from the snapshot | Standard kanban shape; maps cleanly onto the orchestrator's `claimed` / `running` (by `RunAttemptPhase`) / `retryAttempts` / `completed` state.                                                             |
| Lane derivation location      | Pure, unit-tested module `src/client/utils/kanban-lanes.ts`                                    | Keeps the lane mapping deterministic and testable independent of React; the page component stays a thin renderer.                                                                                           |
| Dependency edges              | Card-level `blockedBy` annotations + cross-highlight when the blocker is also on the board     | Delivers "dependency edges" honestly without a graph layout engine (YAGNI). Full SVG edge routing is deferred.                                                                                              |
| Placement                     | New system page registered in `SYSTEM_PAGES` + `ThreadView` registry + `SystemNavItem` icon    | Follows the established dashboard page-registration pattern; discoverable in nav; clean separation from the Orchestrator feed.                                                                              |
| Done lane fidelity            | Compact ID chips (bounded)                                                                     | `completed` on the snapshot is issue IDs only (no rich `Issue`); the board's value is in-flight work, so Done is a lightweight closure strip rather than a full card lane.                                  |
| Reuse of presentation helpers | Reuse `PhaseBadge`, elapsed-time formatting, and empty-state patterns                          | The Orchestrator page already defines phase coloring and elapsed formatting; extract shared bits rather than duplicate.                                                                                     |

## Technical Design

### Data flow (unchanged transport)

```
Orchestrator.getSnapshot()                      [orchestrator, UNCHANGED]
  → WS "state_change" / GET /api/v1/state        [server, UNCHANGED]
    → useOrchestratorSocket() snapshot           [client hook, UNCHANGED]
      → deriveLanes(snapshot)                     [NEW pure util]
        → <Kanban/> page renders lanes + cards    [NEW page + components]
```

### Client type widening

`packages/dashboard/src/client/types/orchestrator.ts` — widen the existing types to match the payload the orchestrator already sends (no `any`, no new wire contract):

```typescript
export interface AgentSession {
  backendName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  turnCount: number;
  lastMessage: string | null;
}

export interface RunningAgent {
  issueId: string;
  identifier: string;
  phase: string;
  startedAt: string;
  workspacePath: string; // NEW — worktree path (already on wire)
  attempt: number | null; // NEW — attempt number (already on wire)
  issue: {
    identifier: string; // NEW
    title: string;
    description: string | null;
    blockedBy: BlockerRef[]; // NEW — dependency edges (already on wire)
  };
  session: AgentSession | null;
}

export interface OrchestratorSnapshot {
  running: Array<[string, RunningAgent]>;
  retryAttempts: Array<[string, RetryEntry]>;
  claimed: string[];
  completed?: string[]; // NEW — bounded issue-id list (already on wire)
  // ...existing fields unchanged
}
```

`BlockerRef` is imported from `@harness-engineering/types` (`{ id, identifier, state }`).

### Lane derivation (`src/client/utils/kanban-lanes.ts`)

A pure function maps a snapshot to ordered lanes:

```typescript
export type LaneId = 'queued' | 'in-progress' | 'blocked' | 'done';

export interface KanbanCard {
  issueId: string;
  identifier: string;
  title: string;
  phase: string | null;
  backendName: string | null;
  workspacePath: string | null;
  attempt: number | null;
  startedAt: string | null;
  blockedBy: BlockerRef[];
  blockerReason: string | null; // retry error / "rate-limited" / "stalled"
  session: AgentSession | null;
}

export interface KanbanLane {
  id: LaneId;
  label: string;
  cards: KanbanCard[];
}

export function deriveLanes(snapshot: OrchestratorSnapshot): KanbanLane[];
```

Lane assignment rules:

- **Queued** — IDs in `claimed[]` not present in `running` (claimed, not yet dispatched). Cards are sparse (id only); rendered minimally.
- **In Progress** — `running` entries whose `phase` ∈ {`PreparingWorkspace`, `BuildingPrompt`, `LaunchingAgent`, `InitializingSession`, `StreamingTurn`, `Finishing`}.
- **Blocked** — `running` entries whose `phase` ∈ {`RateLimitSleeping`, `Stalled`}, plus all `retryAttempts[]` (failed, awaiting retry). `blockerReason` is populated from the retry `error`, or `"rate-limited"` / `"stalled"` from the phase. Global cooldown (`globalCooldownUntilMs`) renders as a board-level banner, not a card.
- **Done** — `completed[]` issue IDs (bounded), rendered as compact chips.

The terminal phases `Succeeded` / `Failed` / `TimedOut` / `CanceledByReconciliation` are transient within `running` before the entry moves to `completed`; they map to In Progress (finishing) / Blocked respectively for the brief window they appear.

### Dependency edges

Each In-Progress/Blocked card renders its `blockedBy` references as chips. `kanban-lanes.ts` exposes a helper `indexBoardIdentifiers(lanes)` returning the set of identifiers present on the board; a blocker chip whose identifier is in that set is marked "on-board" and, on card hover, both the dependent and its on-board blockers receive a highlight ring (pure CSS/state, no layout engine).

### Components & files

- `packages/dashboard/src/client/pages/Kanban.tsx` — NEW page; calls `useOrchestratorSocket`, `deriveLanes`, renders lanes; handles disconnected/empty states.
- `packages/dashboard/src/client/components/kanban/KanbanLane.tsx` — NEW lane column.
- `packages/dashboard/src/client/components/kanban/KanbanCard.tsx` — NEW task card (agent, worktree, phase, elapsed, blockers).
- `packages/dashboard/src/client/utils/kanban-lanes.ts` — NEW pure lane derivation + dependency helpers.
- `packages/dashboard/src/client/utils/phase-presentation.ts` — extract shared phase color/label map and elapsed formatting from `Orchestrator.tsx` for reuse (or a small shared module the kanban imports).

## Integration Points

### Entry Points

- **New dashboard system page** `/s/kanban` ("Work in Flight"). This is the feature's primary entry point.
- **New pure util** `deriveLanes` in `src/client/utils/kanban-lanes.ts` (internal API consumed by the page).
- No new CLI command, MCP tool, skill, or server API route.

### Registrations Required

- `packages/dashboard/src/client/types/thread.ts` — add `{ page: 'kanban', label: 'Work in Flight', route: '/s/kanban' }` to `SYSTEM_PAGES` (this also extends the `SystemPage` union type).
- `packages/dashboard/src/client/components/layout/ThreadView.tsx` — register `kanban: Kanban` in `SYSTEM_PAGE_COMPONENTS` and import the page.
- `packages/dashboard/src/client/components/sidebar/SystemNavItem.tsx` — add a `kanban` icon entry (e.g. `KanbanSquare` from lucide).
- No barrel/export regeneration or skill-tier assignment — the dashboard client is not a published barrel surface.

### Documentation Updates

- `packages/dashboard/README.md` (or the dashboard pages section, if present) — document the new "Work in Flight" board and that it reuses the orchestrator snapshot stream.
- AGENTS.md dashboard section — one line noting the new system page, if such an inventory exists.

### Architectural Decisions

None warrant a standalone ADR. Every decision (reuse the existing snapshot stream, derive lanes client-side, no server changes) follows existing dashboard conventions and introduces no new cross-package contract. This is a small-to-medium, additive, client-only change.

### Knowledge Impact

- Concept: **work-in-flight kanban** as the board view of orchestrator run state, complementing the retrospective health surfaces.
- Relationship: the dashboard's lane model maps onto the orchestrator `RunAttemptPhase` lifecycle — worth a knowledge note so future changes to the phase enum remember to update lane derivation (`kanban-lanes.ts`).

## Success Criteria

1. Navigating to `/s/kanban` renders a "Work in Flight" board with four lanes; the page is reachable from the sidebar nav.
2. While the orchestrator runs agents, each running agent appears as a card in the correct lane, showing owning backend, worktree path, phase badge, and elapsed time, updating live from the WebSocket stream.
3. A task in the retry queue or in a `RateLimitSleeping`/`Stalled` phase appears in the Blocked lane with a human-readable blocker reason.
4. A card whose issue has `blockedBy` references renders those as dependency chips; when a referenced blocker is also on the board, hovering the dependent highlights both.
5. `deriveLanes` is covered by unit tests asserting correct lane assignment for queued/running/blocked/completed/dependency fixtures.
6. With no orchestrator connected or no in-flight work, the board renders a clear empty/disconnected state (no crash).
7. `harness validate`, typecheck, lint, and the dashboard test suite pass. No orchestrator/server source files are modified.

## Implementation Order

1. **Types & lane logic** — widen `types/orchestrator.ts`; add `kanban-lanes.ts` with `deriveLanes` + dependency helpers; unit tests for lane derivation.
2. **Presentation extraction** — factor shared phase color/label + elapsed formatting into a reusable module.
3. **Components** — `KanbanCard`, `KanbanLane`, then the `Kanban` page wiring `useOrchestratorSocket` → `deriveLanes` → lanes, with empty/disconnected states.
4. **Registration** — add to `SYSTEM_PAGES`, `ThreadView` component registry, and `SystemNavItem` icon.
5. **Docs & validation** — update dashboard docs/AGENTS line; run `harness validate`, typecheck, lint, tests.
