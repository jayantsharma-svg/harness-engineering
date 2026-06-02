import matter from 'gray-matter';
import type { StrategyDoc, StrategySection, StrategySectionName } from '@harness-engineering/types';
import { OPTIONAL_STRATEGY_SECTIONS, REQUIRED_STRATEGY_SECTIONS } from '@harness-engineering/types';

/**
 * Lightweight markdown split: returns `{ frontmatter, sections }` where every
 * H2 section's body is the text between its heading and the next H2 (or EOF),
 * trimmed. Unknown H2 names are returned alongside known ones — schema
 * validation decides whether to reject them. The H1 (product title) and any
 * leading prose before the first H2 are intentionally discarded.
 */
export interface ParsedStrategyDoc {
  frontmatter: unknown;
  sections: StrategySection[];
  /** Section names seen that are not in the required/optional union. */
  unknownSectionNames: string[];
}

const KNOWN_SECTION_NAMES = new Set<string>([
  ...REQUIRED_STRATEGY_SECTIONS,
  ...OPTIONAL_STRATEGY_SECTIONS,
]);

interface H2Match {
  name: string;
  /** Index of the `##` character. */
  headingStart: number;
  /** Index just past the trailing newline of the heading line (start of body). */
  bodyStart: number;
}

/**
 * YAML parses unquoted ISO dates (e.g. `last_updated: 2026-06-02`) as Date
 * objects. The schema contract is ISO-string, so coerce here before handing
 * off — users shouldn't have to remember to quote the value.
 */
function coerceFrontmatter(raw: unknown): unknown {
  if (raw === null || typeof raw !== 'object') return raw;
  const out: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  const lu = out.last_updated;
  if (lu instanceof Date && !Number.isNaN(lu.getTime())) {
    const iso = lu.toISOString();
    out.last_updated = iso.slice(0, 10);
  }
  return out;
}

function findH2Matches(body: string): H2Match[] {
  const h2Re = /^##[ \t]+(.+?)[ \t]*$/gm;
  const matches: H2Match[] = [];
  let m: RegExpExecArray | null;
  while ((m = h2Re.exec(body)) !== null) {
    matches.push({
      name: (m[1] ?? '').trim(),
      headingStart: m.index,
      bodyStart: m.index + m[0].length,
    });
  }
  return matches;
}

interface SectionsAccumulator {
  sections: StrategySection[];
  unknownSectionNames: string[];
}

function accumulateSection(acc: SectionsAccumulator, name: string, body: string): void {
  if (KNOWN_SECTION_NAMES.has(name)) {
    acc.sections.push({ name: name as StrategySectionName, body });
  } else {
    acc.unknownSectionNames.push(name);
  }
}

function buildSections(body: string, matches: H2Match[]): SectionsAccumulator {
  const acc: SectionsAccumulator = { sections: [], unknownSectionNames: [] };
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    if (current === undefined) continue;
    const sliceEnd = matches[i + 1]?.headingStart ?? body.length;
    const sectionBody = body.slice(current.bodyStart, sliceEnd).trim();
    accumulateSection(acc, current.name, sectionBody);
  }
  return acc;
}

export function parseStrategyDoc(raw: string): ParsedStrategyDoc {
  const parsed = matter(raw);
  const body = parsed.content;
  const frontmatter = coerceFrontmatter(parsed.data);
  const matches = findH2Matches(body);
  const { sections, unknownSectionNames } = buildSections(body, matches);
  return { frontmatter, sections, unknownSectionNames };
}

/**
 * Type guard helper: narrows a ParsedStrategyDoc into a fully typed StrategyDoc
 * when frontmatter parses successfully. Schema validation (via StrategyDocSchema)
 * is the authoritative gate; this is convenience for callers that want the
 * already-validated shape.
 */
export function asStrategyDoc(parsed: ParsedStrategyDoc): StrategyDoc | null {
  const fm = parsed.frontmatter as Record<string, unknown> | null;
  if (
    fm === null ||
    typeof fm !== 'object' ||
    typeof fm.name !== 'string' ||
    typeof fm.last_updated !== 'string' ||
    typeof fm.version !== 'number'
  ) {
    return null;
  }
  return {
    frontmatter: {
      name: fm.name,
      last_updated: fm.last_updated,
      version: fm.version,
    },
    sections: parsed.sections,
  };
}
