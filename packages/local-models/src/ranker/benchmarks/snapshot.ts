/**
 * Frozen benchmark snapshot loader.
 *
 * The orchestrator falls back to this snapshot whenever the live HF + per-
 * source fetchers are unreachable (network outage, rate limit, transient
 * 5xx). The loader is intentionally lenient: malformed input or a schema
 * mismatch never throws — it returns an empty snapshot with a structured
 * warning so the ranker can still produce a (possibly empty) result instead
 * of crashing the orchestrator (S4).
 *
 * The bundled `snapshot.json` is imported statically so esbuild (tsup) inlines
 * it into the compiled output. There is no runtime file read — the snapshot
 * is part of the bundle. Tests inject an `override` payload via the optional
 * argument to exercise the malformed / schema-invalid / fallback paths.
 *
 * @see docs/changes/local-model-lifecycle-manager/proposal.md (lines 86, 414–429; S4)
 */

import bundledSnapshot from './snapshot.json' with { type: 'json' };
import {
  emptySnapshot,
  type BenchmarkObservation,
  type BenchmarkSnapshot,
  type BenchmarkSnapshotLoadResult,
  type BenchmarkSnapshotWarning,
  type ModelBenchmark,
} from './types.js';

/** Today's date as an ISO `YYYY-MM-DD` string. Pure helper for the fallback envelope. */
function todayIso(now: () => Date): string {
  return now().toISOString().slice(0, 10);
}

/**
 * Load and validate the frozen snapshot. Returns a structured result with a
 * provenance label (`'frozen'` vs `'fallback'`) and any warnings. Always
 * resolves — never throws.
 *
 * Test code passes `options.override` to substitute alternate data and
 * exercise the schema-invalid path.
 */
export async function loadFrozenSnapshot(options?: {
  override?: unknown;
  now?: () => Date;
}): Promise<BenchmarkSnapshotLoadResult> {
  const now = options?.now ?? (() => new Date());
  const data = options?.override ?? bundledSnapshot;

  const validation = validateSnapshot(data);
  if (!validation.ok) {
    return fallback(
      'snapshot_schema_invalid',
      `Frozen benchmark snapshot failed schema validation: ${validation.reason}`,
      now
    );
  }

  return { snapshot: validation.snapshot, source: 'frozen', warnings: [] };
}

function fallback(
  code: BenchmarkSnapshotWarning['code'],
  message: string,
  now: () => Date
): BenchmarkSnapshotLoadResult {
  const warning: BenchmarkSnapshotWarning = { code, message };
  return {
    snapshot: emptySnapshot(todayIso(now)),
    source: 'fallback',
    warnings: [warning],
  };
}

interface ValidationOk {
  ok: true;
  snapshot: BenchmarkSnapshot;
}
interface ValidationFail {
  ok: false;
  reason: string;
}
type ValidationResult = ValidationOk | ValidationFail;

function validateSnapshot(value: unknown): ValidationResult {
  if (!isObject(value)) return { ok: false, reason: 'root is not an object' };
  if (value.version !== 1)
    return { ok: false, reason: `unsupported version ${String(value.version)}` };
  if (typeof value.generatedAt !== 'string')
    return { ok: false, reason: 'generatedAt is not a string' };
  if (value.source !== 'seed' && value.source !== 'snapshot') {
    return {
      ok: false,
      reason: `source must be 'seed' or 'snapshot', got ${String(value.source)}`,
    };
  }
  if (!Array.isArray(value.models)) return { ok: false, reason: 'models is not an array' };

  const models: ModelBenchmark[] = [];
  for (let i = 0; i < value.models.length; i += 1) {
    const modelResult = validateModel(value.models[i], i);
    if (!modelResult.ok) return modelResult;
    models.push(modelResult.model);
  }

  return {
    ok: true,
    snapshot: {
      version: 1,
      generatedAt: value.generatedAt,
      source: value.source,
      models,
    },
  };
}

function validateModel(
  value: unknown,
  index: number
): { ok: true; model: ModelBenchmark } | ValidationFail {
  if (!isObject(value)) return { ok: false, reason: `models[${index}] is not an object` };
  if (typeof value.hfRepoId !== 'string') {
    return { ok: false, reason: `models[${index}].hfRepoId must be a string` };
  }
  if (typeof value.family !== 'string') {
    return { ok: false, reason: `models[${index}].family must be a string` };
  }
  if (typeof value.sizeB !== 'number') {
    return { ok: false, reason: `models[${index}].sizeB must be a number` };
  }
  if (!Array.isArray(value.observations)) {
    return { ok: false, reason: `models[${index}].observations is not an array` };
  }
  const observations: BenchmarkObservation[] = [];
  for (let j = 0; j < value.observations.length; j += 1) {
    const obs = value.observations[j];
    const obsResult = validateObservation(obs, index, j);
    if (!obsResult.ok) return obsResult;
    observations.push(obsResult.observation);
  }
  const model: ModelBenchmark = {
    hfRepoId: value.hfRepoId,
    family: value.family,
    sizeB: value.sizeB,
    observations,
    ...(typeof value.ollamaName === 'string' ? { ollamaName: value.ollamaName } : {}),
    ...(typeof value.activeB === 'number' ? { activeB: value.activeB } : {}),
  };
  return { ok: true, model };
}

function validateObservation(
  value: unknown,
  modelIndex: number,
  obsIndex: number
): { ok: true; observation: BenchmarkObservation } | ValidationFail {
  if (!isObject(value)) {
    return {
      ok: false,
      reason: `models[${modelIndex}].observations[${obsIndex}] is not an object`,
    };
  }
  if (typeof value.source !== 'string') {
    return {
      ok: false,
      reason: `models[${modelIndex}].observations[${obsIndex}].source must be a string`,
    };
  }
  if (typeof value.benchmark !== 'string') {
    return {
      ok: false,
      reason: `models[${modelIndex}].observations[${obsIndex}].benchmark must be a string`,
    };
  }
  if (typeof value.value !== 'number') {
    return {
      ok: false,
      reason: `models[${modelIndex}].observations[${obsIndex}].value must be a number`,
    };
  }
  if (!isEvidence(value.evidence)) {
    return {
      ok: false,
      reason: `models[${modelIndex}].observations[${obsIndex}].evidence is not a known grade`,
    };
  }
  if (typeof value.observedAt !== 'string') {
    return {
      ok: false,
      reason: `models[${modelIndex}].observations[${obsIndex}].observedAt must be a string`,
    };
  }
  return {
    ok: true,
    observation: {
      source: value.source,
      benchmark: value.benchmark,
      value: value.value,
      evidence: value.evidence,
      observedAt: value.observedAt,
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEvidence(value: unknown): value is BenchmarkObservation['evidence'] {
  return (
    value === 'direct' ||
    value === 'variant' ||
    value === 'base' ||
    value === 'interpolated' ||
    value === 'self-reported'
  );
}
