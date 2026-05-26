import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { RoutingDecision } from '@harness-engineering/types';
import { Routing } from '../../../src/client/pages/Routing';

const mkDecision = (overrides: Partial<RoutingDecision> = {}): RoutingDecision => ({
  timestamp: new Date().toISOString(),
  useCase: { kind: 'skill', skillName: 'foo' },
  resolutionPath: [{ source: 'skill', candidate: 'a', outcome: 'chosen' }],
  backendName: 'a',
  backendType: 'anthropic',
  durationMs: 1,
  ...overrides,
});

function setupFetch(opts: { backends: string[]; decisions: RoutingDecision[] }) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/api/v1/routing/config')) {
      return new Response(
        JSON.stringify({
          routing: { default: opts.backends[0] ?? 'a' },
          resolvedChains: {},
          backends: opts.backends,
        }),
        { status: 200 }
      );
    }
    if (url.startsWith('/api/v1/routing/decisions')) {
      return new Response(JSON.stringify({ decisions: opts.decisions }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });
}

beforeEach(() => {
  // Stuck-connecting WebSocket: never opens. Keeps status at connecting/polling.
  const StuckWS = function () {
    return {
      readyState: 0,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      close: () => undefined,
    };
  } as unknown as typeof WebSocket;
  vi.stubGlobal('WebSocket', StuckWS);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Routing page — empty / degraded states (O2)', () => {
  it('renders decisions-empty when ring buffer is empty (Truth 6)', async () => {
    setupFetch({ backends: ['a'], decisions: [] });
    render(<Routing />);
    await waitFor(() => expect(screen.getByTestId('decisions-empty')).toBeDefined());
    expect(screen.getByTestId('decisions-empty').textContent).toBe(
      'No routing decisions recorded yet.'
    );
  });

  it('keeps routing-ws-status out of "live" while WS is stuck connecting', async () => {
    setupFetch({ backends: ['a'], decisions: [] });
    render(<Routing />);
    await waitFor(() => expect(screen.getByTestId('routing-ws-status')).toBeDefined());
    const text = screen.getByTestId('routing-ws-status').textContent;
    expect(text === 'connecting' || text === 'polling').toBe(true);
  });

  it('renders volume rows for backends with zero dispatches as count=0 and rate=— (Truth 7)', async () => {
    setupFetch({
      backends: ['a', 'b', 'c'],
      decisions: [mkDecision({ backendName: 'a' })],
    });
    render(<Routing />);
    await waitFor(() => expect(screen.getByTestId('volume-count-a')).toBeDefined());
    expect(screen.getByTestId('volume-count-a').textContent).toBe('1');
    expect(screen.getByTestId('volume-count-b').textContent).toBe('0');
    expect(screen.getByTestId('volume-rate-b').textContent).toBe('—');
    expect(screen.getByTestId('volume-count-c').textContent).toBe('0');
    expect(screen.getByTestId('volume-rate-c').textContent).toBe('—');
  });
});
