import { EventEmitter } from 'node:events';
import type { ModelPricing, TokenUsage } from '@harness-engineering/types';

/**
 * Per-task cost ceiling specification, mirroring
 * `TaskDefinition.costCeiling` (Hermes Phase 5).
 */
export interface CostCeiling {
  /** Hard cap in USD. Cumulative spend > maxUsd causes the monitor to emit 'abort'. */
  maxUsd: number;
  /** Optional warn threshold expressed as a percentage of `maxUsd` (1-99). */
  warnAtPct?: number;
}

/** Payload emitted on the `'abort'` event. */
export interface CeilingAbortEvent {
  taskId: string;
  costUsd: number;
  ceilingUsd: number;
}

/** Payload emitted on the `'warn'` event. */
export interface CeilingWarnEvent {
  taskId: string;
  costUsd: number;
  ceilingUsd: number;
  pctOfCeiling: number;
}

interface TaskState {
  ceiling: CostCeiling | null;
  costUsd: number;
  abortFired: boolean;
  warnFired: boolean;
}

/** Pricing resolver: model name → ModelPricing or null. */
export type PricingResolver = (model: string) => ModelPricing | null;

export interface CostCeilingMonitorOptions {
  /**
   * Resolver consulted on every `recordTurn` to convert (model, usage) into
   * a USD cost delta. If null is returned, the monitor logs once per
   * task+model pair and records `0` (no abort path can fire).
   */
  resolveModelPricing: PricingResolver;
}

/**
 * Singleton-style monitor that tracks cumulative per-task agent spend and
 * fires `'abort'` once a task exceeds its declared `costCeiling.maxUsd`
 * (D5/D6 in the Phase 5 proposal). The monitor is backend-agnostic — any
 * caller that has a `TokenUsage` and a model name can drive it.
 *
 * Listeners attach via `.on('abort', cb)` / `.on('warn', cb)`. The
 * `'abort'` event fires *once* per task and is then suppressed for the
 * remaining lifetime of that registration.
 *
 * Tasks without a ceiling are tracked for `costUsd` accounting but never
 * emit `'abort'` or `'warn'`.
 */
export class CostCeilingMonitor extends EventEmitter {
  private readonly tasks = new Map<string, TaskState>();
  private readonly missingPricingWarned = new Set<string>();
  private readonly resolveModelPricing: PricingResolver;

  constructor(opts: CostCeilingMonitorOptions) {
    super();
    this.resolveModelPricing = opts.resolveModelPricing;
  }

  /**
   * Register a task with optional ceiling. Safe to call twice for the
   * same id — the second call replaces the prior state and resets the
   * accumulator.
   */
  registerTask(taskId: string, ceiling: CostCeiling | null | undefined): void {
    this.tasks.set(taskId, {
      ceiling: ceiling ?? null,
      costUsd: 0,
      abortFired: false,
      warnFired: false,
    });
  }

  /** True if the task is currently being tracked. */
  isTracking(taskId: string): boolean {
    return this.tasks.has(taskId);
  }

  /**
   * Record token usage for one turn against an active task. Returns the
   * updated cumulative cost in USD. Emits `'warn'` and/or `'abort'` if
   * the relevant thresholds are crossed for the first time.
   *
   * If the task is not registered, this is a no-op (returns 0).
   */
  recordTurn(taskId: string, usage: TokenUsage, model: string | undefined): number {
    const state = this.tasks.get(taskId);
    if (!state) return 0;

    const delta = this.computeCostDelta(taskId, usage, model);
    state.costUsd += delta;

    const ceiling = state.ceiling;
    if (ceiling) {
      if (
        !state.warnFired &&
        ceiling.warnAtPct !== undefined &&
        ceiling.warnAtPct > 0 &&
        ceiling.warnAtPct < 100 &&
        state.costUsd >= (ceiling.maxUsd * ceiling.warnAtPct) / 100
      ) {
        state.warnFired = true;
        const evt: CeilingWarnEvent = {
          taskId,
          costUsd: state.costUsd,
          ceilingUsd: ceiling.maxUsd,
          pctOfCeiling: (state.costUsd / ceiling.maxUsd) * 100,
        };
        this.emit('warn', evt);
      }
      if (!state.abortFired && state.costUsd > ceiling.maxUsd) {
        state.abortFired = true;
        const evt: CeilingAbortEvent = {
          taskId,
          costUsd: state.costUsd,
          ceilingUsd: ceiling.maxUsd,
        };
        this.emit('abort', evt);
      }
    }

    return state.costUsd;
  }

  /** Has this task already fired its abort event? */
  hasAborted(taskId: string): boolean {
    return this.tasks.get(taskId)?.abortFired === true;
  }

  /** Read current cumulative spend without unregistering. */
  getCostUsd(taskId: string): number {
    return this.tasks.get(taskId)?.costUsd ?? 0;
  }

  /**
   * Stop tracking a task. Returns the final cumulative cost. After
   * unregister, further `recordTurn` calls for the same id are no-ops.
   */
  unregisterTask(taskId: string): number {
    const state = this.tasks.get(taskId);
    if (!state) return 0;
    this.tasks.delete(taskId);
    return state.costUsd;
  }

  private computeCostDelta(taskId: string, usage: TokenUsage, model: string | undefined): number {
    if (!model) {
      const key = `${taskId}::<no-model>`;
      if (!this.missingPricingWarned.has(key)) {
        this.missingPricingWarned.add(key);
      }
      return 0;
    }
    const pricing = this.resolveModelPricing(model);
    if (!pricing) {
      const key = `${taskId}::${model}`;
      if (!this.missingPricingWarned.has(key)) {
        this.missingPricingWarned.add(key);
      }
      return 0;
    }
    return computeUsageCostUsd(usage, pricing);
  }
}

/**
 * Pure helper exported for testing: given a {@link TokenUsage} and a
 * {@link ModelPricing}, compute the USD cost of that single turn. Cache
 * read / cache write rates are honored when present on the pricing.
 */
export function computeUsageCostUsd(usage: TokenUsage, pricing: ModelPricing): number {
  const PER_MILLION = 1_000_000;
  const input = (usage.inputTokens / PER_MILLION) * pricing.inputPer1M;
  const output = (usage.outputTokens / PER_MILLION) * pricing.outputPer1M;
  let cacheRead = 0;
  let cacheWrite = 0;
  if (usage.cacheReadTokens && pricing.cacheReadPer1M !== undefined) {
    cacheRead = (usage.cacheReadTokens / PER_MILLION) * pricing.cacheReadPer1M;
  }
  if (usage.cacheCreationTokens && pricing.cacheWritePer1M !== undefined) {
    cacheWrite = (usage.cacheCreationTokens / PER_MILLION) * pricing.cacheWritePer1M;
  }
  return input + output + cacheRead + cacheWrite;
}
