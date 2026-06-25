import type { BlockerRef } from '@harness-engineering/types';
import type { OrchestratorSnapshot, RunningAgent, AgentSession } from '../types/orchestrator';

/** Stable lane identifiers, rendered left-to-right in this order. */
export type LaneId = 'queued' | 'in-progress' | 'blocked' | 'done';

/** A single task card on the work-in-flight board. */
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
  /** Human-readable reason a blocked card is blocked, else null. */
  blockerReason: string | null;
  session: AgentSession | null;
}

export interface KanbanLane {
  id: LaneId;
  label: string;
  cards: KanbanCard[];
}

/** Run-attempt phases that represent healthy, active in-flight work. */
const ACTIVE_PHASES = new Set([
  'PreparingWorkspace',
  'BuildingPrompt',
  'LaunchingAgent',
  'InitializingSession',
  'StreamingTurn',
  'Finishing',
  'Succeeded',
]);

/** Run-attempt phases that indicate the agent is stuck or failing. */
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

function idOnlyCard(issueId: string, blockerReason: string | null, attempt: number | null): KanbanCard {
  return {
    issueId,
    identifier: issueId,
    title: issueId,
    phase: null,
    backendName: null,
    workspacePath: null,
    attempt,
    startedAt: null,
    blockedBy: [],
    blockerReason,
    session: null,
  };
}

/**
 * Derive the four kanban lanes from a point-in-time orchestrator snapshot.
 * Pure: no side effects, deterministic, and independent of React — the page
 * component is a thin renderer over this output.
 */
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
      // Unknown / transient terminal phases (e.g. CanceledByReconciliation)
      // default to in-progress for the brief window before they leave `running`.
      inProgress.push(cardFromRunning(agent, null));
    }
  }

  for (const [, entry] of snapshot.retryAttempts) {
    blocked.push(idOnlyCard(entry.issueId, entry.error ?? 'awaiting retry', entry.attempt));
    // Preserve the human identifier from the retry entry.
    const last = blocked[blocked.length - 1]!;
    last.identifier = entry.identifier;
    last.title = entry.identifier;
  }

  for (const id of snapshot.claimed) {
    if (runningIds.has(id)) continue;
    queued.push(idOnlyCard(id, null, null));
  }

  for (const id of snapshot.completed ?? []) {
    done.push(idOnlyCard(id, null, null));
  }

  return [
    { id: 'queued', label: LANE_LABELS.queued, cards: queued },
    { id: 'in-progress', label: LANE_LABELS['in-progress'], cards: inProgress },
    { id: 'blocked', label: LANE_LABELS.blocked, cards: blocked },
    { id: 'done', label: LANE_LABELS.done, cards: done },
  ];
}

/**
 * Identifiers of all in-flight (non-done) cards on the board. Used to mark
 * dependency chips that point at another task currently on the board.
 */
export function indexBoardIdentifiers(lanes: KanbanLane[]): Set<string> {
  const ids = new Set<string>();
  for (const lane of lanes) {
    if (lane.id === 'done') continue;
    for (const card of lane.cards) ids.add(card.identifier);
  }
  return ids;
}
