import { useRoutingConfig } from '../hooks/useRoutingConfig';
import { useRoutingDecisions } from '../hooks/useRoutingDecisions';
import { RoutingChainsCard } from '../components/cards/RoutingChainsCard';
import { RoutingDecisionsCard } from '../components/cards/RoutingDecisionsCard';
import { RoutingVolumeCard } from '../components/cards/RoutingVolumeCard';
import { RoutingTraceCard } from '../components/cards/RoutingTraceCard';

/**
 * Spec B Phase 7 — /routing observability panel (F9 + O2 + O4).
 *
 * Composition of four cards:
 *   - RoutingChainsCard:    resolved fallback chains from config
 *   - RoutingDecisionsCard: live ring buffer of routing decisions
 *   - RoutingVolumeCard:    24h per-backend dispatch counts
 *   - RoutingTraceCard:     dry-run trace form
 *
 * Two hooks own data:
 *   - useRoutingConfig:     single GET on mount (effectively immutable)
 *   - useRoutingDecisions:  WS subscription with HTTP seed + polling fallback
 */
export function Routing(): JSX.Element {
  const { config, loading: configLoading, error: configError } = useRoutingConfig();
  const { decisions, status, error: decisionsError } = useRoutingDecisions();

  if (configLoading) {
    return (
      <p data-testid="routing-loading" className="text-xs text-neutral-muted">
        Loading routing configuration…
      </p>
    );
  }
  if (configError || !config) {
    return (
      <p data-testid="routing-error" className="text-xs text-rose-400">
        Failed to load routing config: {configError ?? 'unknown error'}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <RoutingChainsCard resolvedChains={config.resolvedChains} decisions={decisions} />
      <RoutingDecisionsCard decisions={decisions} status={status} error={decisionsError} />
      <RoutingVolumeCard decisions={decisions} backends={config.backends} />
      <RoutingTraceCard />
    </div>
  );
}
