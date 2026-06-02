/**
 * STRATEGY.md contract — repo-root strategic anchor read by harness-strategy,
 * harness-ideate, harness-brainstorming, and harness-roadmap-pilot.
 *
 * Schema lives in @harness-engineering/core (packages/core/src/strategy/schema.ts).
 * This file is the cross-layer contract; runtime validation happens in core.
 * BusinessKnowledgeIngestor (packages/graph) imports these types ONLY (no runtime).
 */

export interface StrategyFrontmatter {
  name: string;
  /** ISO date YYYY-MM-DD */
  last_updated: string;
  /** Monotonically increasing schema version, starts at 1. */
  version: number;
}

/** Required section names. Order is intentional — matches the template. */
export const REQUIRED_STRATEGY_SECTIONS = [
  'Target problem',
  'Our approach',
  "Who it's for",
  'Key metrics',
  'Tracks',
] as const;

export type RequiredStrategySection = (typeof REQUIRED_STRATEGY_SECTIONS)[number];

/** Optional section names. */
export const OPTIONAL_STRATEGY_SECTIONS = ['Milestones', 'Not working on', 'Marketing'] as const;

export type OptionalStrategySection = (typeof OPTIONAL_STRATEGY_SECTIONS)[number];

export type StrategySectionName = RequiredStrategySection | OptionalStrategySection;

/**
 * A single section's body — the raw markdown between its H2 heading and the
 * next H2 (or EOF). Includes only non-empty trimmed body content.
 */
export interface StrategySection {
  name: StrategySectionName;
  body: string;
}

/**
 * Parsed STRATEGY.md document. The parser produces this shape from raw text;
 * StrategyDocSchema validates the shape against the spec contract.
 */
export interface StrategyDoc {
  frontmatter: StrategyFrontmatter;
  sections: StrategySection[];
}
