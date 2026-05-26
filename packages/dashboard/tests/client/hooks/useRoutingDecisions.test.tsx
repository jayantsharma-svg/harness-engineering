import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { RoutingDecision } from '@harness-engineering/types';
import { useRoutingDecisions } from '../../../src/client/hooks/useRoutingDecisions';

const mkDecision = (overrides: Partial<RoutingDecision> = {}): RoutingDecision => ({
  timestamp: new Date().toISOString(),
  useCase: { kind: 'skill', skillName: 'harness-debugging' },
  resolutionPath: [{ source: 'skill', candidate: 'claude-opus', outcome: 'chosen' }],
  backendName: 'claude-opus',
  backendType: 'anthropic',
  durationMs: 2,
  ...overrides,
});

class FakeWS {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = 0;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  close = vi.fn(() => {
    this.readyState = FakeWS.CLOSED;
    this.onclose?.({});
  });
}
let lastWS: FakeWS | null = null;

beforeEach(() => {
  lastWS = null;
  const WSCtor = function WSCtor(this: FakeWS) {
    const ws = new FakeWS();
    lastWS = ws;
    queueMicrotask(() => {
      ws.readyState = FakeWS.OPEN;
      ws.onopen?.({});
    });
    return ws;
  } as unknown as typeof WebSocket;
  vi.stubGlobal('WebSocket', WSCtor);
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ decisions: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useRoutingDecisions', () => {
  it('seeds from HTTP on mount, then prepends WS frames', async () => {
    const seeded = mkDecision({ backendName: 'seeded' });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ decisions: [seeded] }), { status: 200 })
    );
    const { result } = renderHook(() => useRoutingDecisions());
    await waitFor(() => expect(result.current.decisions.length).toBe(1));

    const live = mkDecision({ backendName: 'live' });
    await waitFor(() => expect(lastWS).not.toBeNull());
    await waitFor(() => expect(result.current.status).toBe('live'));
    act(() => {
      lastWS!.onmessage?.({
        data: JSON.stringify({ type: 'routing:decision', data: live }),
      });
    });
    await waitFor(() => expect(result.current.decisions[0]?.backendName).toBe('live'));
    expect(result.current.status).toBe('live');
  });

  it('falls back to HTTP polling on WS close (status="polling")', async () => {
    const { result } = renderHook(() => useRoutingDecisions());
    await waitFor(() => expect(result.current.status).toBe('live'));

    // Replace WebSocket with a stuck-connecting variant so reconnect attempts
    // do NOT flip status back to live before polling has a chance to fire.
    const StuckWS = function StuckWS(this: FakeWS) {
      const ws = new FakeWS();
      lastWS = ws;
      // No queueMicrotask -> stays in readyState=0 (CONNECTING)
      return ws;
    } as unknown as typeof WebSocket;
    vi.stubGlobal('WebSocket', StuckWS);

    vi.useFakeTimers();
    act(() => {
      lastWS!.close();
    });
    await vi.waitFor(() => expect(result.current.status).toBe('polling'));

    const polled = mkDecision({ backendName: 'polled' });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ decisions: [polled] }), { status: 200 })
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    // Allow the polling fetch promise to resolve.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await vi.waitFor(() => expect(result.current.decisions[0]?.backendName).toBe('polled'));
  });

  it('caps in-memory buffer at 500 to bound memory under WS-flood', async () => {
    const { result } = renderHook(() => useRoutingDecisions());
    await waitFor(() => expect(result.current.status).toBe('live'));
    act(() => {
      for (let i = 0; i < 600; i++) {
        lastWS!.onmessage?.({
          data: JSON.stringify({
            type: 'routing:decision',
            data: mkDecision({ backendName: `b${i}` }),
          }),
        });
      }
    });
    expect(result.current.decisions.length).toBe(500);
    expect(result.current.decisions[0]?.backendName).toBe('b599');
  });
});
