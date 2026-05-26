import type { BackendDef, RoutingConfig, RoutingDecision } from '@harness-engineering/types';

/**
 * Spec B Phase 7 — client-side mirror of GET /api/v1/routing/config.
 *
 * Server source: packages/orchestrator/src/server/routes/v1/routing.ts (handleConfig).
 * Shape MUST stay in sync with the handler.
 */
export interface RoutingConfigResponse {
  routing: RoutingConfig;
  resolvedChains: Record<string, { candidate: string; exists: boolean }[]>;
  backends: string[];
}

/**
 * Spec B Phase 7 — client-side mirror of GET /api/v1/routing/decisions.
 * Newest-first ordering preserved from server (D-OP-4 from Phase 6).
 */
export interface RoutingDecisionsResponse {
  decisions: RoutingDecision[];
}

/**
 * Spec B Phase 7 — client-side mirror of POST /api/v1/routing/trace.
 * Server source: packages/orchestrator/src/server/routes/v1/routing.ts.
 * Note: `def` is redacted to `{ type }` only (D-OP-6, P5 plan); do not assume
 * full BackendDef fields here.
 */
export interface RoutingTraceResponse {
  decision: RoutingDecision;
  def: { type: BackendDef['type'] };
}

/** WS status surfaced via data-testid="routing-ws-status". */
export type RoutingWsStatus = 'connecting' | 'live' | 'polling';
