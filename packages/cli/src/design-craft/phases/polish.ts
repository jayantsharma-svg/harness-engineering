// packages/cli/src/design-craft/phases/polish.ts
//
// POLISH phase implementation.
//
// For each (target × pattern) pair:
//   1. Lightweight pre-filter via pattern.applicableTo — patterns that
//      cannot possibly apply (no substring match anywhere in the source)
//      are skipped without an LLM call. Keeps fast-mode cheap.
//   2. For surviving (target, pattern) pairs, build the polish prompt
//      (pattern context + target source + before/after sketch) and call
//      provider.callText.
//   3. Parse the response. The LLM is asked to emit `{ applies, tier,
//      impact, confidence, message }`. Only `applies: true` produces a
//      finding; `applies: false` is normal (the pattern simply doesn't
//      match this target) and is dropped.
//   4. Build a CraftFinding with `before`/`after` populated from the
//      pattern. The LLM's message field is used for the per-target
//      narrative; pattern.before/pattern.after are the canonical sketches.
//   5. Compute derived priority via findings/derived.ts.
//
// Honors:
//   - ADR 0019: tier × impact × confidence preserved verbatim from the LLM.
//   - ADR 0020: every finding cites `pattern.id` + `pattern.source` so
//     downstream usage counters work.
//   - Symmetry with critique.ts: same parser (`parseFindingResponse`) is
//     reused with a thin POLISH-specific wrapper to also extract the
//     `applies` boolean.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CraftFinding, Tier, Impact, Confidence } from '../findings/schema.js';
import { derivePriority } from '../findings/derived.js';
import type { PatternDefinition } from '../catalog/patterns/spring-physics.js';
import type { LlmProvider } from '../llm/provider.js';

/** A target component / file to polish. Same shape as CritiqueTarget. */
export interface PolishTarget {
  file: string;
  component?: string;
  source?: string;
}

export interface PolishArgs {
  targets: PolishTarget[];
  patterns: PatternDefinition[];
  provider: LlmProvider;
}

const TIER_VALUES: readonly Tier[] = ['foundational', 'polish', 'aspirational'];
const IMPACT_VALUES: readonly Impact[] = ['small', 'medium', 'large'];
const CONFIDENCE_VALUES: readonly Confidence[] = ['high', 'medium', 'low'];

function isTier(v: unknown): v is Tier {
  return typeof v === 'string' && (TIER_VALUES as readonly string[]).includes(v);
}
function isImpact(v: unknown): v is Impact {
  return typeof v === 'string' && (IMPACT_VALUES as readonly string[]).includes(v);
}
function isConfidence(v: unknown): v is Confidence {
  return typeof v === 'string' && (CONFIDENCE_VALUES as readonly string[]).includes(v);
}

interface ParsedPolishResponse {
  applies: boolean;
  tier: Tier;
  impact: Impact;
  confidence: Confidence;
  message: string;
}

/**
 * Permissive JSON extraction — same strategy as critique.ts. Duplicated
 * here rather than imported because the two phases evolve independently
 * (polish needs the `applies` field; critique does not).
 */
function extractJson(raw: string): unknown {
  const fencedJson = /```json\s*([\s\S]*?)\s*```/i.exec(raw);
  if (fencedJson?.[1]) {
    try {
      return JSON.parse(fencedJson[1]);
    } catch {
      /* fall through */
    }
  }
  const fencedAny = /```[a-z]*\s*([\s\S]*?)\s*```/i.exec(raw);
  if (fencedAny?.[1]) {
    try {
      return JSON.parse(fencedAny[1]);
    } catch {
      /* fall through */
    }
  }
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    } catch {
      /* fall through */
    }
  }
  return null;
}

function validateParsed(value: unknown): ParsedPolishResponse | null {
  if (value === null || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.applies !== 'boolean') return null;
  if (!isTier(obj.tier)) return null;
  if (!isImpact(obj.impact)) return null;
  if (!isConfidence(obj.confidence)) return null;
  if (typeof obj.message !== 'string' || obj.message.trim().length === 0) {
    return null;
  }
  return {
    applies: obj.applies,
    tier: obj.tier,
    impact: obj.impact,
    confidence: obj.confidence,
    message: obj.message,
  };
}

/** Exposed for tests — turn a raw LLM polish response into a structured shape. */
export function parsePolishResponse(raw: string): ParsedPolishResponse | null {
  return validateParsed(extractJson(raw));
}

function readSource(target: PolishTarget): string {
  if (typeof target.source === 'string') return target.source;
  const resolved = path.isAbsolute(target.file)
    ? target.file
    : path.resolve(process.cwd(), target.file);
  return fs.readFileSync(resolved, 'utf8');
}

/**
 * Lightweight pre-filter: does any `applicableTo[].match` substring appear
 * in the source? If none match, the pattern can't apply — skip the LLM
 * call. This is the cheap half of the POLISH cost model.
 *
 * Returns `true` when the pattern is at least plausibly applicable.
 */
export function patternIsPlausible(source: string, pattern: PatternDefinition): boolean {
  if (pattern.applicableTo.length === 0) return true; // no filter declared → always ask
  return pattern.applicableTo.some((rule) => source.includes(rule.match));
}

function formatPrompt(pattern: PatternDefinition, targetId: string, source: string): string {
  return [
    `Evaluate whether the polish pattern "${pattern.name}" (${pattern.id}) applies to ${targetId}.`,
    '',
    'Pattern context:',
    `  when: ${pattern.when}`,
    `  suggest: ${pattern.suggest}`,
    '',
    'Before sketch:',
    '```',
    pattern.before,
    '```',
    '',
    'After sketch:',
    '```',
    pattern.after,
    '```',
    '',
    'Target source under review:',
    '```',
    source,
    '```',
    '',
    "Decide whether the pattern's BEFORE state appears in the target and",
    'whether the suggested AFTER would be a meaningful craft elevation.',
    'Use the 3-axis output model (tier x impact x confidence). Be honest',
    'about confidence — if the target is ambiguous, say so.',
    '',
    'Respond with a single fenced ```json``` block containing an object:',
    '{',
    '  "applies": true | false,',
    '  "tier": "foundational" | "polish" | "aspirational",',
    '  "impact": "small" | "medium" | "large",',
    '  "confidence": "high" | "medium" | "low",',
    '  "message": "<one-paragraph explanation of why the pattern applies (or does not)>"',
    '}',
  ].join('\n');
}

function buildFinding(
  target: PolishTarget,
  pattern: PatternDefinition,
  parsed: ParsedPolishResponse
): CraftFinding {
  return {
    code: pattern.findingTemplate.code,
    phase: 'polish',
    tier: parsed.tier,
    impact: parsed.impact,
    confidence: parsed.confidence,
    target: {
      file: target.file,
      ...(target.component ? { component: target.component } : {}),
    },
    message: parsed.message,
    cite: {
      rubricOrPatternId: pattern.id,
      source: pattern.source.url ?? pattern.source.ref,
    },
    before: pattern.before,
    after: pattern.after,
    derived: { priority: derivePriority(parsed.tier, parsed.impact, parsed.confidence) },
  };
}

/**
 * Run the POLISH phase over `targets × patterns`.
 *
 * MVP scope: sequential awaits (cost-deterministic); lightweight applicability
 * pre-filter; no parse-failure sentinel for now (POLISH parse failures are
 * dropped rather than emitted as low-confidence findings because POLISH is
 * suggestion-only — a sentinel would noise the report).
 */
export async function runPolish(args: PolishArgs): Promise<CraftFinding[]> {
  const findings: CraftFinding[] = [];
  for (const target of args.targets) {
    const source = readSource(target);
    const targetId = target.component ?? target.file;
    for (const pattern of args.patterns) {
      if (!patternIsPlausible(source, pattern)) continue;
      const prompt = formatPrompt(pattern, targetId, source);
      const raw = await args.provider.callText(prompt);
      const parsed = parsePolishResponse(raw);
      if (parsed === null || !parsed.applies) continue;
      findings.push(buildFinding(target, pattern, parsed));
    }
  }
  return findings;
}
