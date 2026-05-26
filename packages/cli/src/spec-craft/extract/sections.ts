/**
 * Markdown section parser — splits a spec by H2 (`## ...`) into named
 * sections. Frontmatter (`--- ... ---`) is stripped before parsing.
 *
 * Source: docs/changes/craft-pipeline/spec-craft/proposal.md
 *   (Technical Design → Section parser).
 */

export interface ParsedSection {
  /** Original H2 heading text (e.g., "Decisions", "Out-of-scope (v1)"). */
  heading: string;
  /** Normalized form for rubric matching: lowercase, hyphenated. */
  canonical: string;
  /** Section body content (everything between this H2 and the next). */
  body: string;
  /** First line of the section body, 1-indexed. */
  line: number;
  /** Line AFTER the section (exclusive). 1-indexed. */
  endLine: number;
}

export function parseSections(markdown: string): ParsedSection[] {
  const stripped = stripFrontmatter(markdown);
  const lines = stripped.split('\n');
  const sections: ParsedSection[] = [];
  let current: { heading: string; bodyLines: string[]; line: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      // Close out previous section
      if (current !== null) {
        sections.push(finalize(current, i + 1));
      }
      current = { heading: h2[1]!, bodyLines: [], line: i + 2 };
      continue;
    }
    if (current !== null) {
      current.bodyLines.push(line);
    }
  }
  if (current !== null) {
    sections.push(finalize(current, lines.length + 1));
  }
  return sections;
}

function finalize(
  current: { heading: string; bodyLines: string[]; line: number },
  endLine: number
): ParsedSection {
  return {
    heading: current.heading,
    canonical: canonicalize(current.heading),
    body: current.bodyLines.join('\n').trim(),
    line: current.line,
    endLine,
  };
}

export function canonicalize(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripFrontmatter(markdown: string): string {
  // Match leading YAML frontmatter (--- ... ---) and remove it.
  const match = /^---\n[\s\S]*?\n---\n?/.exec(markdown);
  if (match === null) return markdown;
  return markdown.slice(match[0].length);
}
