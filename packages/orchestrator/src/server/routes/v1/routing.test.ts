import { describe, it, expect } from 'vitest';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { BackendRouter } from '../../../agent/backend-router';
import { RoutingDecisionBus } from '../../../routing/decision-bus';
import { handleV1RoutingRoute } from './routing';
import type { BackendDef, RoutingConfig } from '@harness-engineering/types';

function makeReq(method: string, url: string): IncomingMessage {
  const r = new IncomingMessage(new Socket());
  r.method = method;
  r.url = url;
  process.nextTick(() => r.emit('end'));
  return r;
}

function makeRes(): {
  res: ServerResponse;
  chunks: string[];
  statusCode: () => number;
} {
  const sock = new Socket();
  const r = new ServerResponse(new IncomingMessage(sock));
  const chunks: string[] = [];
  r.write = ((c: string) => {
    chunks.push(String(c));
    return true;
  }) as ServerResponse['write'];
  r.end = ((c?: string) => {
    if (c) chunks.push(String(c));
    return r;
  }) as ServerResponse['end'];
  return { res: r, chunks, statusCode: () => r.statusCode };
}

describe('handleV1RoutingRoute — GET /api/v1/routing/config', () => {
  it('returns 200 with routing + resolvedChains + backends', () => {
    const backends: Record<string, BackendDef> = {
      'claude-opus': { type: 'anthropic', model: 'claude-opus-4-7' },
      'local-fast': { type: 'local', endpoint: 'http://localhost:1234/v1', model: 'qwen3:8b' },
    };
    const routing: RoutingConfig = {
      default: 'claude-opus',
      'quick-fix': ['local-fast', 'claude-opus'],
      skills: { 'harness-debugging': 'local-fast' },
    };
    const router = new BackendRouter({ backends, routing });
    const bus = new RoutingDecisionBus();
    const req = makeReq('GET', '/api/v1/routing/config');
    const { res, chunks, statusCode } = makeRes();
    const handled = handleV1RoutingRoute(req, res, { router, bus, routing, backends });
    expect(handled).toBe(true);
    expect(statusCode()).toBe(200);
    const body = JSON.parse(chunks.join(''));
    expect(body.backends).toEqual(['claude-opus', 'local-fast']);
    expect(body.routing).toEqual(routing);
    expect(body.resolvedChains['default']).toEqual([{ candidate: 'claude-opus', exists: true }]);
    expect(body.resolvedChains['tier:quick-fix']).toEqual([
      { candidate: 'local-fast', exists: true },
      { candidate: 'claude-opus', exists: true },
    ]);
    expect(body.resolvedChains['skill:harness-debugging']).toEqual([
      { candidate: 'local-fast', exists: true },
    ]);
  });

  it('returns 503 when router is null', () => {
    const req = makeReq('GET', '/api/v1/routing/config');
    const { res, chunks, statusCode } = makeRes();
    const handled = handleV1RoutingRoute(req, res, {
      router: null,
      bus: null,
      routing: null,
      backends: null,
    });
    expect(handled).toBe(true);
    expect(statusCode()).toBe(503);
    expect(chunks.join('')).toContain('BackendRouter not available');
  });
});
