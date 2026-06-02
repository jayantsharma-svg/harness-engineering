import { z } from 'zod';
import type {
  StrategyDoc,
  StrategyFrontmatter,
  StrategySection,
  StrategySectionName,
} from '@harness-engineering/types';
import { OPTIONAL_STRATEGY_SECTIONS, REQUIRED_STRATEGY_SECTIONS } from '@harness-engineering/types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Match an angle-bracket placeholder *anywhere on a line* whose bracket
 * content contains whitespace — the signature of template hint text like
 * `<2-4 sentences. ...>`, `<metric 1>`, `<how it's measured, where it lives>`.
 *
 * Avoids false positives on inline references whose bracket content is a
 * single token: `<https://example.com>`, `<email@example.com>`, HTML-like
 * `<br>` / `<MyComponent>`.
 */
const PLACEHOLDER_INLINE = /<[^<>\n]*\s[^<>\n]*>/;

const REQUIRED = new Set<StrategySectionName>(REQUIRED_STRATEGY_SECTIONS);
const ALLOWED = new Set<StrategySectionName>([
  ...REQUIRED_STRATEGY_SECTIONS,
  ...OPTIONAL_STRATEGY_SECTIONS,
]);

export const StrategyFrontmatterSchema = z.object({
  name: z.string().min(1, 'frontmatter.name must be a non-empty string'),
  last_updated: z.string().regex(ISO_DATE, 'frontmatter.last_updated must be ISO date YYYY-MM-DD'),
  version: z
    .number()
    .int('frontmatter.version must be an integer')
    .positive('frontmatter.version must be ≥ 1'),
}) satisfies z.ZodType<StrategyFrontmatter>;

const StrategySectionSchema = z.object({
  name: z.enum([...REQUIRED_STRATEGY_SECTIONS, ...OPTIONAL_STRATEGY_SECTIONS] as [
    StrategySectionName,
    ...StrategySectionName[],
  ]),
  body: z.string(),
}) satisfies z.ZodType<StrategySection>;

/**
 * Returns the list of non-whitespace, non-blank trimmed lines in a section body.
 * Stripping blanks is what lets us check "the sole non-whitespace content is a
 * placeholder line."
 */
function nonBlankLines(body: string): string[] {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * A body fails the body-content gate when:
 *   1. It has no non-blank lines (empty section), OR
 *   2. ANY non-blank line contains an angle-bracket placeholder whose bracket
 *      content has internal whitespace (template hint pattern).
 *
 * Rule (2) catches header-only docs, partial fills, and bullet-list templates
 * like `- <metric 1>: <how it's measured>`. Inline references with no
 * whitespace inside brackets (`<https://example.com>`, `<email@example.com>`)
 * do NOT trip the rule.
 */
function bodyContentIssue(body: string): string | null {
  const lines = nonBlankLines(body);
  if (lines.length === 0) {
    return 'section is empty';
  }
  for (const line of lines) {
    if (PLACEHOLDER_INLINE.test(line)) {
      return `unfilled template placeholder detected (${line})`;
    }
  }
  return null;
}

/**
 * Top-level schema: validates frontmatter + section coverage + body content.
 *
 * Section invariants (enforced via superRefine because they cross-cut multiple
 * sections):
 *   - All sections in REQUIRED_STRATEGY_SECTIONS must be present.
 *   - Required sections must pass `bodyContentIssue` (non-empty + no placeholder lines).
 *   - Optional sections, if present, must also pass `bodyContentIssue` — an
 *     "optional" section that exists but contains only placeholder text is
 *     still a half-finished doc and fails.
 *   - No unknown section names beyond REQUIRED ∪ OPTIONAL.
 */
export const StrategyDocSchema = z
  .object({
    frontmatter: StrategyFrontmatterSchema,
    sections: z.array(StrategySectionSchema),
  })
  .superRefine((doc, ctx) => {
    const seen = new Set<StrategySectionName>();
    for (const section of doc.sections) {
      if (!ALLOWED.has(section.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `unknown section "${section.name}" — only documented sections are allowed`,
          path: ['sections'],
        });
        continue;
      }
      if (seen.has(section.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `section "${section.name}" appears more than once`,
          path: ['sections'],
        });
      }
      seen.add(section.name);

      const issue = bodyContentIssue(section.body);
      if (issue !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `section "${section.name}": ${issue}`,
          path: ['sections', section.name],
        });
      }
    }
    for (const required of REQUIRED) {
      if (!seen.has(required)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `required section "${required}" is missing`,
          path: ['sections', required],
        });
      }
    }
  }) satisfies z.ZodType<StrategyDoc>;
