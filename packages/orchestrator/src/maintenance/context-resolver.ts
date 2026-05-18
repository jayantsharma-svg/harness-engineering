import type { TaskOutputStore, PersistedOutputEntry } from './output-store';
import type { MaintenanceLogger } from './scheduler';

/**
 * Hermes Phase 2 — Reads an inline-skill body by name. Wraps the host's
 * skill registry; absent skills resolve to `null` so the resolver can
 * warn-and-skip instead of throwing.
 */
export interface InlineSkillReader {
  read(skillName: string): Promise<string | null>;
}

export interface ContextResolverOptions {
  outputStore: TaskOutputStore;
  skillReader?: InlineSkillReader;
  logger?: MaintenanceLogger;
  /** Per-upstream truncation bound. Default: 2000 chars. */
  perUpstreamMaxChars?: number;
}

/**
 * Resolves Hermes Phase 2 prompt-context inputs for a maintenance task:
 *
 *   - `resolveContextFrom(taskIds, opts)`: pulls each upstream's latest
 *     output from the store, applies stale/missing markers, and emits a
 *     `## Upstream context` markdown block.
 *
 *   - `resolveInlineSkills(skillNames, budgetTokens)`: pulls each skill's
 *     markdown body via the registry, applies a per-skill char-count
 *     budget (4 chars ≈ 1 token), warns-then-truncates on overflow, and
 *     emits a `## Reference skills` markdown block.
 *
 * Both methods return an empty string when their inputs are absent so
 * callers can `prompt = skills + upstream + base` without conditional
 * scaffolding.
 */
export class ContextResolver {
  private outputStore: TaskOutputStore;
  private skillReader: InlineSkillReader | null;
  private logger: MaintenanceLogger;
  private perUpstreamMaxChars: number;

  constructor(options: ContextResolverOptions) {
    this.outputStore = options.outputStore;
    this.skillReader = options.skillReader ?? null;
    this.logger = options.logger ?? fallbackLogger;
    this.perUpstreamMaxChars = options.perUpstreamMaxChars ?? 2000;
  }

  async resolveContextFrom(
    upstreamTaskIds: string[] | undefined,
    options: { maxAgeMinutes?: number } = {}
  ): Promise<string> {
    if (!upstreamTaskIds || upstreamTaskIds.length === 0) return '';
    const maxAgeMs = (options.maxAgeMinutes ?? 1440) * 60 * 1000;
    const now = Date.now();
    const sections: string[] = [];
    for (const id of upstreamTaskIds) {
      const entry = await this.outputStore.latest(id);
      sections.push(this.formatUpstream(id, entry, now, maxAgeMs));
    }
    return `## Upstream context\n\n${sections.join('\n\n')}\n`;
  }

  async resolveInlineSkills(
    skillNames: string[] | undefined,
    budgetTokens: number = 8000
  ): Promise<string> {
    if (!skillNames || skillNames.length === 0) return '';
    if (!this.skillReader) return '';

    // Char-count heuristic: ~4 chars per token.
    const charBudget = budgetTokens * 4;
    let used = 0;
    const sections: string[] = [];
    let truncatedAt = -1;
    for (let i = 0; i < skillNames.length; i++) {
      const name = skillNames[i]!;
      const body = await this.skillReader.read(name);
      if (body === null) {
        this.logger.warn('inlineSkills: skill not found in registry', { name });
        continue;
      }
      const block = `### ${name}\n\n${body}`;
      if (used + block.length > charBudget) {
        truncatedAt = i;
        break;
      }
      used += block.length;
      sections.push(block);
    }
    if (truncatedAt >= 0) {
      this.logger.warn(
        `inlineSkillsBudgetTokens (${budgetTokens}) exhausted after ${sections.length} of ${skillNames.length} skills; truncated.`
      );
    }
    if (sections.length === 0) return '';
    return `## Reference skills\n\n${sections.join('\n\n')}\n`;
  }

  private formatUpstream(
    id: string,
    entry: PersistedOutputEntry | null,
    now: number,
    maxAgeMs: number
  ): string {
    if (!entry) {
      return `### ${id}\n\n_[no prior run]_`;
    }
    const completedMs = Date.parse(entry.completedAt);
    if (Number.isFinite(completedMs) && now - completedMs > maxAgeMs) {
      return `### ${id} (last run ${entry.completedAt}, stale)\n\n_[stale: omitted]_`;
    }
    const head = `### ${id} (last run ${entry.completedAt}, status=${entry.status}, findings=${entry.findings})`;
    const body = (entry.stdout ?? '').trim();
    const truncated =
      body.length > this.perUpstreamMaxChars
        ? `${body.slice(0, this.perUpstreamMaxChars)}\n\n_[truncated]_`
        : body;
    return `${head}\n\n${truncated || '_[no stdout captured]_'}`;
  }
}

const fallbackLogger: MaintenanceLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};
