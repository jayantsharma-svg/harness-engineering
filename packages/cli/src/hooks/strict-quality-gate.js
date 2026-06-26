#!/usr/bin/env node
// strict-quality-gate.js — PostToolUse:Edit/Write hook (strict profile only)
// Runs the project formatter/linter after edits and BLOCKS on real violations.
// Exit codes:
//   0 = allow (clean, or infra-error → fail open)
//   2 = block (genuine format/lint violations; stderr is fed back to Claude)
//
// A PostToolUse hook that exits 2 surfaces its stderr to Claude as a must-fix:
// the edit already landed, so the model is told to correct the violation.
//
// Fail-open contract: when the formatter is absent, times out, or its output is
// unparseable (status 'infra-error'), this hook writes a loud warning and exits
// 0 — a missing formatter must not wall off every edit. See format-check.js.

import process from 'node:process';
import { runFormatCheck, readHookInput } from './format-check.js';

function main() {
  const input = readHookInput(0);
  if (!input) {
    process.exit(0);
  }

  try {
    const result = runFormatCheck(input, process.cwd());

    if (result.status === 'violations') {
      process.stderr.write(
        `[strict-quality-gate] BLOCKED — ${result.message}\n` +
          `Fix the formatting/lint violations above before continuing.\n`
      );
      process.exit(2);
    }

    if (result.status === 'infra-error') {
      process.stderr.write(`[strict-quality-gate] WARNING (failing open) — ${result.message}\n`);
      process.exit(0);
    }

    // clean
    process.exit(0);
  } catch {
    // Unexpected error — fail open.
    process.exit(0);
  }
}

main();
