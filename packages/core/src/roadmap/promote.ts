/**
 * Roadmap promotion: the brainstorm-complete → planned state transition.
 *
 * Pure function over `(Roadmap, args) → (PromoteCoreResult, Roadmap)`. No IO.
 * State-transition business rules live here (not in skill markdown) so every
 * caller — brainstorming today, autopilot and the dashboard later — shares one
 * source of truth. See docs/changes/brainstorm-auto-promote/proposal.md (D6).
 *
 * The MCP handler owns parse/serialize/write and adds the `write-failed`
 * envelope variant if its IO throws; that variant is part of the public
 * `PromoteResult` consumed by callers, not this function's contract.
 */
import type { Roadmap, RoadmapFeature } from '@harness-engineering/types';

const EM_DASH = '—';

export interface RoadmapPromoteArgs {
  /** ARGUMENTS string (D1); trimmed, case-insensitive lookup against headings. */
  feature: string;
  /** Path to docs/changes/<feature>/proposal.md. */
  spec: string;
  /** H1 from the spec; applied only when the row's summary is empty (D5). */
  summary?: string;
}

/**
 * Results the pure core can produce. IO failures (`write-failed`) are added by
 * the MCP handler — see `RoadmapPromoteResult`.
 */
export type RoadmapPromoteCoreResult =
  | {
      ok: true;
      transitioned: 'backlog→planned' | 'spec-updated' | 'noop';
      feature: string;
    }
  | { ok: false; reason: 'in-progress' | 'done'; detail: string; feature: string }
  | {
      ok: false;
      reason: 'not-found';
      detail: string;
      feature: string;
      closestMatches: string[];
    }
  | { ok: false; reason: 'ambiguous'; detail: string; feature: string; matches: string[] };

/** Public envelope: core results plus the handler-level IO failure variant. */
export type RoadmapPromoteResult =
  | RoadmapPromoteCoreResult
  | { ok: false; reason: 'write-failed'; detail: string; feature: string };

interface FeatureLocation {
  milestoneName: string;
  feature: RoadmapFeature;
}

/** True when a summary carries no human content (empty, whitespace, or em-dash). */
function isEmptySummary(summary: string | null | undefined): boolean {
  if (!summary) return true;
  const trimmed = summary.trim();
  return trimmed === '' || trimmed === EM_DASH;
}

/** Case-insensitive Levenshtein edit distance. Local to keep roadmap cohesive. */
function editDistance(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i, ...new Array<number>(n).fill(0)];
    for (let j = 1; j <= n; j++) {
      const cost = s.charAt(i - 1) === t.charAt(j - 1) ? 0 : 1;
      curr[j] = Math.min((prev[j] ?? 0) + 1, (curr[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = curr;
  }
  return prev[n] ?? 0;
}

/** Up to `k` nearest feature names to `name`, closest first. */
function closestMatches(name: string, all: string[], k = 3): string[] {
  return all
    .map((candidate) => ({ candidate, distance: editDistance(name, candidate) }))
    .sort((a, b) => a.distance - b.distance || a.candidate.localeCompare(b.candidate))
    .slice(0, k)
    .map((entry) => entry.candidate);
}

/** Every milestone+feature whose heading exactly matches the lookup key. */
function findMatches(roadmap: Roadmap, key: string): FeatureLocation[] {
  const matches: FeatureLocation[] = [];
  for (const milestone of roadmap.milestones) {
    for (const feature of milestone.features) {
      if (feature.name.trim().toLowerCase() === key) {
        matches.push({ milestoneName: milestone.name, feature });
      }
    }
  }
  return matches;
}

/**
 * Transition a roadmap row toward `planned`, applying the D2 state machine,
 * D4 idempotency, and D5 field-write policy. Returns the structured result and
 * a new roadmap (the input is never mutated).
 */
export function promoteFeature(
  roadmap: Roadmap,
  args: RoadmapPromoteArgs
): { result: RoadmapPromoteCoreResult; nextRoadmap: Roadmap } {
  const key = args.feature.trim().toLowerCase();
  const matches = findMatches(roadmap, key);

  // 0 matches — not found, offer the nearest names as a typo hint (D1).
  if (matches.length === 0) {
    const allNames = roadmap.milestones.flatMap((m) => m.features.map((f) => f.name));
    return {
      result: {
        ok: false,
        reason: 'not-found',
        detail: `No roadmap row matches "${args.feature}".`,
        feature: args.feature,
        closestMatches: closestMatches(args.feature, allNames),
      },
      nextRoadmap: roadmap,
    };
  }

  // 2+ matches — refuse and require milestone-qualified disambiguation (D1, S3-001).
  if (matches.length > 1) {
    const qualified = matches.map((m) => `${m.milestoneName} > ${m.feature.name}`);
    return {
      result: {
        ok: false,
        reason: 'ambiguous',
        detail: `"${args.feature}" matches multiple rows across milestones.`,
        feature: args.feature,
        matches: qualified,
      },
      nextRoadmap: roadmap,
    };
  }

  const current = matches[0]!.feature;

  // Terminal / active states refuse without mutation (D2).
  if (current.status === 'in-progress') {
    return {
      result: {
        ok: false,
        reason: 'in-progress',
        detail: `"${current.name}" is in-progress; an agent may be dispatched against this row.`,
        feature: current.name,
      },
      nextRoadmap: roadmap,
    };
  }
  if (current.status === 'done') {
    return {
      result: {
        ok: false,
        reason: 'done',
        detail: `"${current.name}" is already done; use a new name to revise a shipped feature.`,
        feature: current.name,
      },
      nextRoadmap: roadmap,
    };
  }

  // Idempotent no-op: already promoted with the same spec (D4).
  if (current.status !== 'backlog' && current.spec === args.spec) {
    return {
      result: { ok: true, transitioned: 'noop', feature: current.name },
      nextRoadmap: roadmap,
    };
  }

  // Mutating transitions operate on a clone so the input stays untouched.
  const nextRoadmap = structuredClone(roadmap);
  const target = findMatches(nextRoadmap, key)[0]!.feature;

  target.spec = args.spec;
  if (args.summary !== undefined && isEmptySummary(target.summary)) {
    target.summary = args.summary;
  }

  if (current.status === 'backlog') {
    target.status = 'planned';
    return {
      result: { ok: true, transitioned: 'backlog→planned', feature: current.name },
      nextRoadmap,
    };
  }

  // planned / blocked / needs-human: spec link updated, status preserved (D2).
  return {
    result: { ok: true, transitioned: 'spec-updated', feature: current.name },
    nextRoadmap,
  };
}
