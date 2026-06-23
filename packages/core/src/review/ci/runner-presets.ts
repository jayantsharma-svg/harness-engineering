import type { CiReviewVerdict } from './verdict-schema';

/** A headless invocation descriptor: the argv the orchestrator shells out to. */
export interface HeadlessInvocation {
  /** Executable name expected on PATH (e.g. 'claude'). */
  command: string;
  /** Args builder given the review instruction + diff path. */
  args: (opts: { instruction: string; diffPath: string }) => string[];
}

interface SupportedPreset {
  supported: true;
  secretEnvVar: string;
  headlessInvocation: (opts: { instruction: string; diffPath: string }) => {
    command: string;
    args: string[];
  };
  verdictParser: (raw: string) => CiReviewVerdict;
}

interface UnsupportedPreset {
  supported: false;
  unsupportedReason: string;
}

export type RunnerPreset = SupportedPreset | UnsupportedPreset;

export type SupportedRunnerId = 'claude' | 'gemini' | 'codex';
export type RunnerId = SupportedRunnerId | 'cursor';

export const RUNNER_PRESETS: Record<RunnerId, RunnerPreset> = {
  // claude/gemini/codex filled in Tasks 6-9 (verdictParser wired from ./parsers).
  claude: { supported: false, unsupportedReason: 'TODO Task 6' } as RunnerPreset,
  gemini: { supported: false, unsupportedReason: 'TODO Task 7' } as RunnerPreset,
  codex: { supported: false, unsupportedReason: 'TODO Task 8' } as RunnerPreset,
  cursor: {
    supported: false,
    unsupportedReason:
      'cursor headless CI invocation is unverified and the CLI is not present in this environment; ' +
      'deferred to a real CI run per the required-review-ci re-scope decision.',
  },
};

export function isSupportedRunner(id: RunnerId): id is SupportedRunnerId {
  return RUNNER_PRESETS[id].supported === true;
}
