import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { RoutingDecision } from '@harness-engineering/types';
import { Routing } from '../../../src/client/pages/Routing';

describe('Routing — perf (Q2)', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/v1/routing/config')) {
        return new Response(
          JSON.stringify({
            routing: { default: 'a' },
            resolvedChains: { default: [{ candidate: 'a', exists: true }] },
            backends: ['a', 'b'],
          }),
          { status: 200 }
        );
      }
      if (url.startsWith('/api/v1/routing/decisions')) {
        const decisions: RoutingDecision[] = Array.from({ length: 500 }, (_, i) => ({
          timestamp: new Date(Date.now() - i * 1000).toISOString(),
          useCase: { kind: 'skill', skillName: `skill-${i % 50}` },
          resolutionPath: [{ source: 'skill', candidate: 'a', outcome: 'chosen' }],
          backendName: i % 2 === 0 ? 'a' : 'b',
          backendType: 'anthropic',
          durationMs: 2,
        }));
        return new Response(JSON.stringify({ decisions }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });
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

  // NOTE: Q2 perf gate is a jsdom canary (D-OP-5), not an absolute SLA.
  // If CI flakes raise to 600 ms with a NOTE; do not silently disable.
  it('renders 500-decision buffer in under 500 ms (jsdom canary)', async () => {
    const t0 = performance.now();
    render(<Routing />);
    await screen.findByTestId('routing-card-decisions');
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(500);
  });
});
