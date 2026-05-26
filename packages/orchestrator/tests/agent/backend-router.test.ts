import { describe, it, expect, vi } from 'vitest';
import type { BackendDef, RoutingConfig, RoutingUseCase } from '@harness-engineering/types';
import { BackendRouter } from '../../src/agent/backend-router.js';
import { RoutingDecisionBus } from '../../src/routing/decision-bus.js';

const cloud: BackendDef = { type: 'claude', command: 'claude' };
const local: BackendDef = {
  type: 'pi',
  endpoint: 'http://pi.local:1234/v1',
  model: ['gemma-4-e4b'],
};

describe('BackendRouter — resolution', () => {
  it('returns the named backend for a tier scope', () => {
    const routing: RoutingConfig = { default: 'cloud', 'quick-fix': 'local' };
    const router = new BackendRouter({ backends: { cloud, local }, routing });
    const useCase: RoutingUseCase = { kind: 'tier', tier: 'quick-fix' };
    expect(router.resolve(useCase).backendName).toBe('local');
  });

  it('falls back to default when a tier scope is not in routing', () => {
    const routing: RoutingConfig = { default: 'cloud', 'quick-fix': 'local' };
    const router = new BackendRouter({ backends: { cloud, local }, routing });
    expect(router.resolve({ kind: 'tier', tier: 'guided-change' }).backendName).toBe('cloud');
  });

  it('falls back to default for the maintenance use case (always default per SC19)', () => {
    const routing: RoutingConfig = { default: 'cloud' };
    const router = new BackendRouter({ backends: { cloud }, routing });
    expect(router.resolve({ kind: 'maintenance' }).backendName).toBe('cloud');
  });

  it('falls back to default for the chat use case (SC20)', () => {
    const routing: RoutingConfig = { default: 'cloud', 'quick-fix': 'local' };
    const router = new BackendRouter({ backends: { cloud, local }, routing });
    expect(router.resolve({ kind: 'chat' }).backendName).toBe('cloud');
  });

  it('returns the BackendDef reference (identity, not a copy) from resolveDefinition', () => {
    const routing: RoutingConfig = { default: 'cloud', 'quick-fix': 'local' };
    const backends = { cloud, local };
    const router = new BackendRouter({ backends, routing });
    expect(router.resolveDefinition({ kind: 'tier', tier: 'quick-fix' })).toBe(backends.local);
    expect(router.resolveDefinition({ kind: 'tier', tier: 'guided-change' })).toBe(backends.cloud);
  });

  it('resolves intelligence-layer routes when set', () => {
    const routing: RoutingConfig = {
      default: 'cloud',
      intelligence: { sel: 'local' },
    };
    const router = new BackendRouter({ backends: { cloud, local }, routing });
    expect(router.resolve({ kind: 'intelligence', layer: 'sel' }).backendName).toBe('local');
  });

  it('falls back to default when intelligence layer is unmapped', () => {
    const routing: RoutingConfig = {
      default: 'cloud',
      intelligence: { sel: 'local' },
    };
    const router = new BackendRouter({ backends: { cloud, local }, routing });
    expect(router.resolve({ kind: 'intelligence', layer: 'pesl' }).backendName).toBe('cloud');
  });

  it('falls back to default when intelligence map is absent', () => {
    const routing: RoutingConfig = { default: 'cloud' };
    const router = new BackendRouter({ backends: { cloud }, routing });
    expect(router.resolve({ kind: 'intelligence', layer: 'sel' }).backendName).toBe('cloud');
  });
});

describe('BackendRouter — isolation tier (Hermes Phase 5)', () => {
  const remote: BackendDef = {
    type: 'ssh',
    host: 'gpu-box.lab',
    remoteCommand: 'harness-agent',
    isolation: 'remote-sandbox',
  };
  const sandbox: BackendDef = {
    type: 'serverless',
    adapter: 'oci',
    image: 'ghcr.io/example/agent:1',
    isolation: 'remote-sandbox',
  };

  it('resolves a remote-sandbox isolation request to the configured backend', () => {
    const routing: RoutingConfig = {
      default: 'cloud',
      isolation: { 'remote-sandbox': 'remote' },
    };
    const router = new BackendRouter({ backends: { cloud, remote }, routing });
    expect(router.resolve({ kind: 'isolation', tier: 'remote-sandbox' }).backendName).toBe(
      'remote'
    );
  });

  it('falls back to default when the isolation tier is unmapped', () => {
    const routing: RoutingConfig = {
      default: 'cloud',
      isolation: { container: 'sandbox' },
    };
    const router = new BackendRouter({
      backends: { cloud, sandbox: { ...sandbox, isolation: 'container' } },
      routing,
    });
    expect(router.resolve({ kind: 'isolation', tier: 'remote-sandbox' }).backendName).toBe('cloud');
  });

  it('falls back to default when the isolation map is absent entirely', () => {
    const routing: RoutingConfig = { default: 'cloud' };
    const router = new BackendRouter({ backends: { cloud }, routing });
    expect(router.resolve({ kind: 'isolation', tier: 'container' }).backendName).toBe('cloud');
  });

  it('throws when routing.isolation references an unknown backend', () => {
    const routing: RoutingConfig = {
      default: 'cloud',
      isolation: { 'remote-sandbox': 'ghost' },
    };
    expect(() => new BackendRouter({ backends: { cloud }, routing })).toThrowError(
      /isolation\.remote-sandbox.*ghost/
    );
  });

  it('resolveDefinition returns the BackendDef reference for isolation routes', () => {
    const routing: RoutingConfig = {
      default: 'cloud',
      isolation: { 'remote-sandbox': 'remote' },
    };
    const backends = { cloud, remote };
    const router = new BackendRouter({ backends, routing });
    expect(router.resolveDefinition({ kind: 'isolation', tier: 'remote-sandbox' })).toBe(
      backends.remote
    );
  });
});

describe('BackendRouter — construction-time validation', () => {
  it('throws when routing.default names a missing backend', () => {
    const routing: RoutingConfig = { default: 'nope' };
    expect(() => new BackendRouter({ backends: { cloud }, routing })).toThrowError(
      /unknown backend.*nope/
    );
  });

  it('throws when a tier scope names a missing backend', () => {
    const routing: RoutingConfig = { default: 'cloud', diagnostic: 'ghost' };
    expect(() => new BackendRouter({ backends: { cloud }, routing })).toThrowError(
      /diagnostic.*ghost/
    );
  });

  it('throws when an intelligence layer names a missing backend', () => {
    const routing: RoutingConfig = {
      default: 'cloud',
      intelligence: { sel: 'phantom' },
    };
    expect(() => new BackendRouter({ backends: { cloud }, routing })).toThrowError(
      /intelligence\.sel.*phantom/
    );
  });

  it('lists known backends in the error for diagnostics', () => {
    const routing: RoutingConfig = { default: 'nope' };
    expect(() => new BackendRouter({ backends: { cloud, local }, routing })).toThrowError(
      /Defined backends.*cloud.*local|Defined backends.*local.*cloud/
    );
  });
});

describe('BackendRouter + createBackend integration', () => {
  it('round-trips: router resolves def, factory builds matching backend class', async () => {
    const { createBackend } = await import('../../src/agent/backend-factory.js');
    const { ClaudeBackend } = await import('../../src/agent/backends/claude.js');
    const { PiBackend } = await import('../../src/agent/backends/pi.js');

    const routing: RoutingConfig = {
      default: 'cloud',
      'quick-fix': 'local',
      intelligence: { sel: 'local' },
    };
    const router = new BackendRouter({ backends: { cloud, local }, routing });

    const cloudDef = router.resolveDefinition({ kind: 'tier', tier: 'guided-change' });
    const localDef = router.resolveDefinition({ kind: 'tier', tier: 'quick-fix' });
    const intelDef = router.resolveDefinition({ kind: 'intelligence', layer: 'sel' });

    expect(createBackend(cloudDef)).toBeInstanceOf(ClaudeBackend);
    expect(createBackend(localDef)).toBeInstanceOf(PiBackend);
    expect(createBackend(intelDef)).toBeInstanceOf(PiBackend);
  });
});

describe('BackendRouter — decision bus emission (Spec B Phase 4)', () => {
  it('emits exactly one decision per resolve() when a bus is provided', () => {
    const bus = new RoutingDecisionBus({ capacity: 5 });
    const emitSpy = vi.spyOn(bus, 'emit');
    const router = new BackendRouter({
      backends: { cloud, local },
      routing: { default: 'cloud', 'quick-fix': 'local' },
      decisionBus: bus,
    });
    router.resolve({ kind: 'tier', tier: 'quick-fix' });
    router.resolve({ kind: 'tier', tier: 'guided-change' });
    expect(emitSpy).toHaveBeenCalledTimes(2);
    expect(bus.recent()).toHaveLength(2);
  });

  it('does not throw when no bus is provided (legacy ctor shape)', () => {
    const router = new BackendRouter({
      backends: { cloud, local },
      routing: { default: 'cloud' },
    });
    expect(() => router.resolve({ kind: 'tier', tier: 'quick-fix' })).not.toThrow();
  });

  it('resolveDecisionAndDef: single resolve() call, returns matching decision+def', () => {
    const bus = new RoutingDecisionBus({ capacity: 5 });
    const backends = { cloud, local };
    const router = new BackendRouter({
      backends,
      routing: { default: 'cloud', 'quick-fix': 'local' },
      decisionBus: bus,
    });
    const { decision, def } = router.resolveDecisionAndDef({
      kind: 'tier',
      tier: 'quick-fix',
    });
    expect(decision.backendName).toBe('local');
    expect(def).toBe(backends.local); // identity
    expect(bus.recent()).toHaveLength(1); // one emit, not two
  });
});
