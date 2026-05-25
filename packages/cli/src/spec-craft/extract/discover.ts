/**
 * Spec discovery — finds proposal + ADR files under a project root.
 *
 * v1 scope: docs/changes/*\/proposal.md + docs/knowledge/decisions/*.md.
 * v1.x will add RFCs and other structured doc types via per-type globs.
 *
 * Source: docs/changes/craft-pipeline/spec-craft/proposal.md
 *   (Scope → In-scope → Spec discovery).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export type SpecKind = 'proposal' | 'adr';

export interface DiscoveredSpec {
  file: string;
  kind: SpecKind;
}

export function discoverSpecs(
  projectRoot: string,
  kindsFilter?: ReadonlyArray<SpecKind>
): DiscoveredSpec[] {
  const wantProposal = kindsFilter === undefined || kindsFilter.includes('proposal');
  const wantADR = kindsFilter === undefined || kindsFilter.includes('adr');

  const out: DiscoveredSpec[] = [];

  if (wantProposal) {
    const changesDir = path.join(projectRoot, 'docs', 'changes');
    if (fs.existsSync(changesDir)) {
      for (const entry of fs.readdirSync(changesDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.')) continue;
        // Recurse one level: docs/changes/<topic>/proposal.md OR
        // docs/changes/<topic>/<sub>/proposal.md
        const topicDir = path.join(changesDir, entry.name);
        const direct = path.join(topicDir, 'proposal.md');
        if (fs.existsSync(direct)) {
          out.push({ file: direct, kind: 'proposal' });
        }
        // One more level for initiatives with sub-projects (design-pipeline, craft-pipeline)
        for (const sub of fs.readdirSync(topicDir, { withFileTypes: true })) {
          if (!sub.isDirectory()) continue;
          if (sub.name.startsWith('.')) continue;
          const subProposal = path.join(topicDir, sub.name, 'proposal.md');
          if (fs.existsSync(subProposal)) {
            out.push({ file: subProposal, kind: 'proposal' });
          }
        }
      }
    }
  }

  if (wantADR) {
    const decisionsDir = path.join(projectRoot, 'docs', 'knowledge', 'decisions');
    if (fs.existsSync(decisionsDir)) {
      for (const entry of fs.readdirSync(decisionsDir, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        if (!entry.name.endsWith('.md')) continue;
        if (entry.name.startsWith('.') || entry.name.toUpperCase() === 'README.MD') continue;
        out.push({ file: path.join(decisionsDir, entry.name), kind: 'adr' });
      }
    }
  }

  return out;
}
