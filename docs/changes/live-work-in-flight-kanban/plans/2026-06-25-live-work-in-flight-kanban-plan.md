# Plan: Live Work-in-Flight Kanban

**Date:** 2026-06-25 | **Spec:** docs/changes/live-work-in-flight-kanban/proposal.md | **Tasks:** 7 | **Time:** ~32 min | **Integration Tier:** medium

## Goal

Add a `/s/kanban` "Work in Flight" dashboard page that groups live orchestrator state into kanban lanes (Queued, In Progress, Blocked, Done) with per-task cards showing owning agent, worktree, phase, blockers, and dependency edges — reusing the existing `useOrchestratorSocket` snapshot stream with zero server changes.

## Observable Truths (Acceptance Criteria)

1. The system shall expose `deriveLanes(snapshot)` returning four ordered lanes; given a fixture snapshot with a claimed-only id, a running `StreamingTurn` agent, a `retryAttempts` entry, and a `completed` id, it places each in `queued` / `in-progress` / `blocked` / `done` respectively (`npx vitest run tests/client/utils/kanban-lanes.test.ts` passes).
2. While an agent runs, the Kanban page shall render a card in the matching lane showing the backend name, the worktree basename, a phase badge, and elapsed time (driven by the WebSocket `state_change` snapshot).
3. If a task is in the retry queue or in a `RateLimitSleeping`/`Stalled` phase, then the card shall appear in the Blocked lane with a human-readable `blockerReason`.
4. When a card's issue has `blockedBy` references, the system shall render them as dependency chips; chips whose identifier is also present on the board are marked on-board.
5. The system shall register `kanban` in `SYSTEM_PAGES`, `SYSTEM_PAGE_COMPONENTS`, and the sidebar icon map so `/s/kanban` is reachable from the nav.
6. If no orchestrator is connected or no work is in flight, then the page shall render an empty/disconnected state without throwing.
7. `harness validate`, typecheck, lint, and the dashboard test suite pass; no files under `packages/orchestrator/` or `packages/dashboard/src/server/` are modified.

## File Map

- MODIFY packages/dashboard/src/client/types/orchestrator.ts (widen `RunningAgent`/`AgentSession`/`OrchestratorSnapshot`; import `BlockerRef`)
- MODIFY packages/dashboard/tests/client/types/orchestrator.test.ts (exercise new fields)
- CREATE packages/dashboard/src/client/utils/kanban-lanes.ts
- CREATE packages/dashboard/tests/client/utils/kanban-lanes.test.ts
- CREATE packages/dashboard/src/client/utils/phase-presentation.ts
- CREATE packages/dashboard/tests/client/utils/phase-presentation.test.ts
- CREATE packages/dashboard/src/client/components/kanban/KanbanCard.tsx
- CREATE packages/dashboard/src/client/components/kanban/KanbanLane.tsx
- CREATE packages/dashboard/src/client/pages/Kanban.tsx
- CREATE packages/dashboard/tests/client/pages/Kanban.test.tsx
- MODIFY packages/dashboard/src/client/types/thread.ts (add to `SYSTEM_PAGES`)
- MODIFY packages/dashboard/src/client/components/layout/ThreadView.tsx (register component)
- MODIFY packages/dashboard/src/client/components/sidebar/SystemNavItem.tsx (icon)
- MODIFY packages/dashboard/README.md (document the board)

## Skeleton

1. Types foundation — widen client types + type test (~1 task, ~4 min)
2. Pure logic — lane derivation + phase presentation, both TDD (~2 tasks, ~12 min)
3. UI — card, lane, page + smoke test (~2 tasks, ~12 min)
4. Integration — registration + docs (~2 tasks, ~6 min)

_Skeleton approved: yes (autonomous run — self-approved; below 8-task threshold)._

## Change Specifications

- [ADDED] `/s/kanban` system page and its components.
- [ADDED] `deriveLanes` + dependency helpers in `kanban-lanes.ts`.
- [ADDED] shared `phase-presentation.ts` (phase color/label + elapsed formatting).
- [MODIFIED] `RunningAgent` widened with `workspacePath`, `attempt`, `issue.identifier`, `issue.blockedBy`; `OrchestratorSnapshot` adds optional `completed`. These match the wire payload `getSnapshot()` already sends — no new wire contract.

## Tasks

### Task 1: Widen client orchestrator types to match the wire payload

**Depends on:** none | **Files:** packages/dashboard/src/client/types/orchestrator.ts, packages/dashboard/tests/client/types/orchestrator.test.ts

1. In `types/orchestrator.ts`, add `BlockerRef` to the import from `@harness-engineering/types`:
   ```typescript
   import type {
     LocalModelStatus,
     NamedLocalModelStatus,
     RoutingDecision,
     BlockerRef,
   } from '@harness-engineering/types';
   ```
2. Replace the `RunningAgent` interface with:
   ```typescript
   /** A running agent entry from the orchestrator snapshot. */
   export interface RunningAgent {
     issueId: string;
     identifier: string;
     phase: string;
     startedAt: string;
     /** Worktree path the agent runs in (already on the wire via RunningEntry). */
     workspacePath: string;
     /** Run-attempt number, null before the first attempt is recorded. */
     attempt: number | null;
     issue: {
       identifier: string;
       title: string;
       description: string | null;
       /** Dependency edges — issues that block this one. */
       blockedBy: BlockerRef[];
     };
     session: AgentSession | null;
   }
   ```
3. In `OrchestratorSnapshot`, add the optional `completed` field after `claimed`:
   ```typescript
     claimed: string[];
     /** Bounded list of recently completed issue IDs (already on the wire). */
     completed?: string[];
   ```
4. In `tests/client/types/orchestrator.test.ts`, update the `RunningAgent has session fields` literal to include the new required fields:
   ```typescript
   const agent: RunningAgent = {
     issueId: 'issue-1',
     identifier: 'test-issue',
     phase: 'StreamingTurn',
     startedAt: new Date().toISOString(),
     workspacePath: '/tmp/wt/test-issue',
     attempt: 1,
     issue: {
       identifier: 'TEST-1',
       title: 'Add feature X',
       description: null,
       blockedBy: [],
     },
     session: {
       backendName: 'local',
       inputTokens: 40,
       outputTokens: 60,
       totalTokens: 100,
       turnCount: 3,
       lastMessage: 'Working...',
     },
   };
   expect(agent.session?.totalTokens).toBe(100);
   expect(agent.workspacePath).toContain('test-issue');
   ```
5. Run: `npx vitest run tests/client/types/orchestrator.test.ts` (from `packages/dashboard`) — observe pass.
6. Run: `harness validate`
7. Commit: `feat(dashboard): widen orchestrator client types for kanban fields`

### Task 2 (TDD): Lane derivation util

**Depends on:** Task 1 | **Files:** packages/dashboard/src/client/utils/kanban-lanes.ts, packages/dashboard/tests/client/utils/kanban-lanes.test.ts

**Skills:** `ts-testing-types` (reference), `ts-type-guards` (reference)

1. Write `tests/client/utils/kanban-lanes.test.ts` FIRST. Build a helper that constructs an `OrchestratorSnapshot` and assert:
   - a `claimed` id absent from `running` → `queued` lane.
   - a `running` agent with `phase: 'StreamingTurn'` → `in-progress` lane; card carries `backendName`, `workspacePath`, `startedAt`.
   - a `running` agent with `phase: 'Stalled'` → `blocked` lane with `blockerReason === 'stalled'`.
   - a `retryAttempts` entry → `blocked` lane with `blockerReason` equal to its `error`.
   - a `completed` id → `done` lane.
   - `deriveLanes` always returns lanes in order `['queued','in-progress','blocked','done']`.
   - `indexBoardIdentifiers(lanes)` returns a `Set` containing identifiers of queued/in-progress/blocked cards.
2. Run: `npx vitest run tests/client/utils/kanban-lanes.test.ts` — observe failure (module missing).
3. Create `src/client/utils/kanban-lanes.ts`:

   ```typescript
   import type { BlockerRef } from '@harness-engineering/types';
   import type { OrchestratorSnapshot, RunningAgent, AgentSession } from '../types/orchestrator';

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
     blockerReason: string | null;
     session: AgentSession | null;
   }

   export interface KanbanLane {
     id: LaneId;
     label: string;
     cards: KanbanCard[];
   }

   const ACTIVE_PHASES = new Set([
     'PreparingWorkspace',
     'BuildingPrompt',
     'LaunchingAgent',
     'InitializingSession',
     'StreamingTurn',
     'Finishing',
     'Succeeded',
   ]);
   const BLOCKED_PHASES = new Set(['RateLimitSleeping', 'Stalled', 'Failed', 'TimedOut']);

   const LANE_LABELS: Record<LaneId, string> = {
     queued: 'Queued',
     'in-progress': 'In Progress',
     blocked: 'Blocked',
     done: 'Done',
   };

   function blockerReasonForPhase(phase: string): string | null {
     if (phase === 'RateLimitSleeping') return 'rate-limited';
     if (phase === 'Stalled') return 'stalled';
     if (phase === 'Failed') return 'failed';
     if (phase === 'TimedOut') return 'timed out';
     return null;
   }

   function cardFromRunning(agent: RunningAgent, blockerReason: string | null): KanbanCard {
     return {
       issueId: agent.issueId,
       identifier: agent.issue?.identifier ?? agent.identifier,
       title: agent.issue?.title ?? agent.identifier,
       phase: agent.phase,
       backendName: agent.session?.backendName ?? null,
       workspacePath: agent.workspacePath ?? null,
       attempt: agent.attempt ?? null,
       startedAt: agent.startedAt ?? null,
       blockedBy: agent.issue?.blockedBy ?? [],
       blockerReason,
       session: agent.session,
     };
   }

   export function deriveLanes(snapshot: OrchestratorSnapshot): KanbanLane[] {
     const queued: KanbanCard[] = [];
     const inProgress: KanbanCard[] = [];
     const blocked: KanbanCard[] = [];
     const done: KanbanCard[] = [];

     const runningIds = new Set(snapshot.running.map(([id]) => id));

     for (const [, agent] of snapshot.running) {
       if (BLOCKED_PHASES.has(agent.phase)) {
         blocked.push(cardFromRunning(agent, blockerReasonForPhase(agent.phase)));
       } else if (ACTIVE_PHASES.has(agent.phase)) {
         inProgress.push(cardFromRunning(agent, null));
       } else {
         // Unknown/terminal-cancel phases default to in-progress (transient).
         inProgress.push(cardFromRunning(agent, null));
       }
     }

     for (const [, entry] of snapshot.retryAttempts) {
       blocked.push({
         issueId: entry.issueId,
         identifier: entry.identifier,
         title: entry.identifier,
         phase: null,
         backendName: null,
         workspacePath: null,
         attempt: entry.attempt,
         startedAt: null,
         blockedBy: [],
         blockerReason: entry.error ?? 'awaiting retry',
         session: null,
       });
     }

     for (const id of snapshot.claimed) {
       if (runningIds.has(id)) continue;
       queued.push({
         issueId: id,
         identifier: id,
         title: id,
         phase: null,
         backendName: null,
         workspacePath: null,
         attempt: null,
         startedAt: null,
         blockedBy: [],
         blockerReason: null,
         session: null,
       });
     }

     for (const id of snapshot.completed ?? []) {
       done.push({
         issueId: id,
         identifier: id,
         title: id,
         phase: null,
         backendName: null,
         workspacePath: null,
         attempt: null,
         startedAt: null,
         blockedBy: [],
         blockerReason: null,
         session: null,
       });
     }

     return [
       { id: 'queued', label: LANE_LABELS.queued, cards: queued },
       { id: 'in-progress', label: LANE_LABELS['in-progress'], cards: inProgress },
       { id: 'blocked', label: LANE_LABELS.blocked, cards: blocked },
       { id: 'done', label: LANE_LABELS.done, cards: done },
     ];
   }

   /** Identifiers of all in-flight (non-done) cards on the board. */
   export function indexBoardIdentifiers(lanes: KanbanLane[]): Set<string> {
     const ids = new Set<string>();
     for (const lane of lanes) {
       if (lane.id === 'done') continue;
       for (const card of lane.cards) ids.add(card.identifier);
     }
     return ids;
   }
   ```

4. Run: `npx vitest run tests/client/utils/kanban-lanes.test.ts` — observe pass.
5. Run: `harness validate`
6. Commit: `feat(dashboard): add kanban lane derivation util`

### Task 3 (TDD): Shared phase-presentation module

**Depends on:** Task 2 | **Files:** packages/dashboard/src/client/utils/phase-presentation.ts, packages/dashboard/tests/client/utils/phase-presentation.test.ts

1. Write `tests/client/utils/phase-presentation.test.ts` FIRST asserting:
   - `phaseColor('StreamingTurn')` returns a non-empty class string and `phaseColor('UnknownXYZ')` returns the gray default.
   - `formatElapsed(startISO, nowMs)` returns `'5s'` for a 5s delta, `'2m 3s'` for 123s, `'1h 1m'` for 3660s, and `'0s'` for a future start.
2. Run the test — observe failure.
3. Create `src/client/utils/phase-presentation.ts` exporting:

   ```typescript
   export const PHASE_COLORS: Record<string, string> = {
     PreparingWorkspace: 'bg-yellow-900/50 text-yellow-400',
     BuildingPrompt: 'bg-yellow-900/50 text-yellow-400',
     LaunchingAgent: 'bg-blue-900/50 text-blue-400',
     InitializingSession: 'bg-blue-900/50 text-blue-400',
     StreamingTurn: 'bg-emerald-900/50 text-emerald-400',
     RateLimitSleeping: 'bg-orange-900/50 text-orange-400',
     Finishing: 'bg-purple-900/50 text-purple-400',
     Succeeded: 'bg-emerald-900/50 text-emerald-300',
     Failed: 'bg-red-900/50 text-red-400',
     TimedOut: 'bg-red-900/50 text-red-400',
     Stalled: 'bg-orange-900/50 text-orange-400',
     CanceledByReconciliation: 'bg-gray-800 text-gray-400',
   };

   export function phaseColor(phase: string): string {
     return PHASE_COLORS[phase] ?? 'bg-gray-800 text-gray-400';
   }

   /** Human-readable elapsed time between an ISO start and `nowMs`. */
   export function formatElapsed(startedAt: string, nowMs: number): string {
     const seconds = Math.max(0, Math.floor((nowMs - new Date(startedAt).getTime()) / 1000));
     if (seconds < 60) return `${seconds}s`;
     const minutes = Math.floor(seconds / 60);
     if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
     const hours = Math.floor(minutes / 60);
     return `${hours}h ${minutes % 60}m`;
   }
   ```

4. Run the test — observe pass.
5. Run: `harness validate`
6. Commit: `feat(dashboard): extract shared phase presentation helpers`

### Task 4: Kanban card and lane components

**Depends on:** Task 3 | **Files:** packages/dashboard/src/client/components/kanban/KanbanCard.tsx, packages/dashboard/src/client/components/kanban/KanbanLane.tsx

1. Create `components/kanban/KanbanCard.tsx`. Props: `{ card: KanbanCard; onBoardIdentifiers: Set<string>; nowMs: number }`. Render:
   - title (truncated) + a phase badge using `phaseColor(card.phase)` when `card.phase` is set.
   - a meta row: `card.identifier`, backend (`card.backendName ?? 'pending'`), elapsed via `formatElapsed(card.startedAt, nowMs)` when `startedAt` is set, and attempt (`#{attempt}`) when set.
   - worktree row when `card.workspacePath`: a monospace `basename` (split on `/`, last segment) with the full path in `title=` attribute.
   - blocker row when `card.blockerReason`: red text `Blocked: {blockerReason}`.
   - dependency chips when `card.blockedBy.length`: for each `b`, a chip showing `b.identifier ?? b.id`; add an "on-board" ring class when `onBoardIdentifiers.has(b.identifier ?? '')`.
   - Root element gets `data-testid="kanban-card"` and `data-identifier={card.identifier}`.
2. Create `components/kanban/KanbanLane.tsx`. Props: `{ lane: KanbanLane; onBoardIdentifiers: Set<string>; nowMs: number }`. Render a column with the lane label, a count badge (`lane.cards.length`), and the cards (or an "—" placeholder when empty). For the `done` lane, render compact chips (identifier only) instead of full cards. Root gets `data-testid={`lane-${lane.id}`}`.
3. Use existing Tailwind conventions seen in `Orchestrator.tsx` (`rounded-lg border border-gray-800 bg-gray-900`, etc.).
4. Run: `harness validate`
5. Commit: `feat(dashboard): add kanban card and lane components`

### Task 5: Kanban page with live data + smoke test

**Depends on:** Task 4 | **Files:** packages/dashboard/src/client/pages/Kanban.tsx, packages/dashboard/tests/client/pages/Kanban.test.tsx

1. Create `pages/Kanban.tsx`:
   - `export function Kanban()`.
   - Call `useOrchestratorSocket()` for `{ snapshot, connected }`.
   - A `useNow()` ticking-second hook (mirror the one in `Orchestrator.tsx`) for elapsed timers.
   - When `!connected && !snapshot`: render a centered "Orchestrator not connected" empty state.
   - When `snapshot` present: `const lanes = deriveLanes(snapshot); const ids = indexBoardIdentifiers(lanes);`. If every lane is empty, render a "No work in flight" empty state.
   - If `snapshot.globalCooldownUntilMs && Date.now() < snapshot.globalCooldownUntilMs`: render a top cooldown banner.
   - Render the four lanes in a responsive grid (`grid grid-cols-1 md:grid-cols-4 gap-4`), passing `onBoardIdentifiers={ids}` and `nowMs`.
   - Page heading "Work in Flight".
2. Write `tests/client/pages/Kanban.test.tsx` (jsdom). Mock `../../src/client/hooks/useOrchestratorSocket` with `vi.mock` to return a snapshot containing one running `StreamingTurn` agent and one `retryAttempts` entry. Render `<Kanban/>` (wrap in `MemoryRouter` if needed) and assert:
   - a `[data-testid="lane-in-progress"]` contains the running agent's title.
   - a `[data-testid="lane-blocked"]` contains the retry blocker text.
   - Mock with empty snapshot → "No work in flight" text present.
     Follow the render-test style of `tests/client/components/SignalCard.test.tsx`.
3. Run: `npx vitest run tests/client/pages/Kanban.test.tsx` — observe pass.
4. Run: `harness validate`
5. Commit: `feat(dashboard): add Work in Flight kanban page`

### Task 6: Register the page (nav, route, icon)

**Depends on:** Task 5 | **Files:** packages/dashboard/src/client/types/thread.ts, packages/dashboard/src/client/components/layout/ThreadView.tsx, packages/dashboard/src/client/components/sidebar/SystemNavItem.tsx | **Category:** integration

1. In `types/thread.ts` `SYSTEM_PAGES`, add after the `orchestrator` entry:
   ```typescript
     { page: 'kanban', label: 'Work in Flight', route: '/s/kanban' },
   ```
2. In `components/layout/ThreadView.tsx`, import the page and register it:
   ```typescript
   import { Kanban } from '../../pages/Kanban';
   ```
   and in `SYSTEM_PAGE_COMPONENTS` add `kanban: Kanban,` next to `orchestrator: Orchestrator,`.
3. In `components/sidebar/SystemNavItem.tsx`, import `KanbanSquare` from `lucide-react` and add `kanban: KanbanSquare,` to `PAGE_ICONS`.
4. Run: `npx vitest run tests/client/types/thread.test.ts` — observe pass (page list still valid).
5. Run: `harness validate`
6. Commit: `feat(dashboard): register Work in Flight kanban page in nav and routes`

### Task 7: Document the board

**Depends on:** Task 6 | **Files:** packages/dashboard/README.md | **Category:** integration

1. In `packages/dashboard/README.md`, add a short subsection under the pages/feature list (create the section if absent) describing the "Work in Flight" board: it groups live orchestrator state into Queued / In Progress / Blocked / Done lanes, reuses the `useOrchestratorSocket` WebSocket snapshot, and is read-only (no server changes). Note dependency edges are surfaced as per-card `blockedBy` chips.
2. Run: `harness validate`
3. Commit: `docs(dashboard): document Work in Flight kanban board`

## Uncertainties

- [ASSUMPTION] The orchestrator's `getSnapshot()` serializes the full `RunningEntry` (incl. `workspacePath`, `attempt`, full `issue` with `blockedBy`) — verified at `packages/orchestrator/src/orchestrator.ts:1962` and `types/internal.ts:42`. If a future change trims the payload, Task 1's types and Task 2's derivation would need revision.
- [ASSUMPTION] `completed` on the snapshot is issue IDs only (no rich `Issue`) — verified at `orchestrator.ts:1973`. The Done lane is intentionally lightweight as a result.
- [DEFERRABLE] Exact Tailwind styling/spacing of cards — finalized during implementation against existing `Orchestrator.tsx` conventions.
- [DEFERRABLE] Whether to later draw routed SVG dependency edges — explicitly out of scope (spec non-goal); v1 uses chips + cross-highlight.
