import { useEffect, useRef, useState } from 'react';
import type { RoutingDecision } from '@harness-engineering/types';
import type { WebSocketMessage } from '../types/orchestrator';
import type { RoutingDecisionsResponse, RoutingWsStatus } from '../types/routing';

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const POLL_INTERVAL_MS = 5_000;
const BUFFER_LIMIT = 500;

export interface UseRoutingDecisionsResult {
  decisions: RoutingDecision[];
  status: RoutingWsStatus;
  error: string | null;
}

function getWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

async function fetchDecisions(signal?: AbortSignal): Promise<RoutingDecision[]> {
  const init: RequestInit = signal ? { signal } : {};
  const res = await fetch(`/api/v1/routing/decisions?limit=${BUFFER_LIMIT}`, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as RoutingDecisionsResponse;
  return json.decisions;
}

/**
 * Spec B Phase 7 — subscribe to routing:decision WS topic with HTTP
 * seed + polling fallback. Standalone (owns its own socket); do not
 * mount in a parent that already opens /ws — see useLocalModelStatuses
 * JSDoc for the same constraint.
 */
export function useRoutingDecisions(): UseRoutingDecisionsResult {
  const [decisions, setDecisions] = useState<RoutingDecision[]>([]);
  const [status, setStatus] = useState<RoutingWsStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // HTTP seed on mount.
  useEffect(() => {
    const controller = new AbortController();
    fetchDecisions(controller.signal)
      .then((rows) => setDecisions(rows))
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => controller.abort();
  }, []);

  // WS subscription + polling fallback.
  useEffect(() => {
    const mounted = { current: true };

    function startPolling(): void {
      if (pollTimer.current) return;
      pollTimer.current = setInterval(() => {
        fetchDecisions()
          .then((rows) => {
            if (mounted.current) setDecisions(rows);
          })
          .catch(() => {
            /* swallow — next tick retries */
          });
      }, POLL_INTERVAL_MS);
    }
    function stopPolling(): void {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    }
    function connect(): void {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;
      ws.onopen = () => {
        if (!mounted.current) return;
        reconnectAttempt.current = 0;
        stopPolling();
        setStatus('live');
      };
      ws.onmessage = (event: MessageEvent<string>) => {
        if (!mounted.current) return;
        try {
          const raw: unknown = JSON.parse(event.data);
          if (typeof raw !== 'object' || raw === null || !('type' in raw)) return;
          const msg = raw as WebSocketMessage;
          if (msg.type === 'routing:decision') {
            setDecisions((prev) => {
              const next = [msg.data, ...prev];
              return next.length > BUFFER_LIMIT ? next.slice(0, BUFFER_LIMIT) : next;
            });
          }
        } catch {
          /* ignore malformed */
        }
      };
      ws.onclose = () => {
        if (!mounted.current) return;
        setStatus('polling');
        startPolling();
        const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempt.current, RECONNECT_MAX_MS);
        reconnectAttempt.current += 1;
        reconnectTimer.current = setTimeout(connect, delay);
      };
      ws.onerror = () => {
        /* onclose handles reconnect */
      };
    }
    connect();
    return () => {
      mounted.current = false;
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      stopPolling();
    };
  }, []);

  return { decisions, status, error };
}
