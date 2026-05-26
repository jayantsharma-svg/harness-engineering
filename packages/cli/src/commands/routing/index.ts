import { Command } from 'commander';
import { createConfigCommand } from './config';
import { createTraceCommand } from './trace';
import { createDecisionsCommand } from './decisions';

/**
 * Spec B Phase 6: `harness routing` subcommand group. Operator-facing
 * inspection of routing config, dry-run trace, and recent decisions.
 * Consumes the Phase 5 routes under `/api/v1/routing/{config,trace,decisions}`.
 */
export function createRoutingCommand(): Command {
  const cmd = new Command('routing').description(
    'Inspect routing config, trace decisions, and read recent dispatches'
  );
  cmd.addCommand(createConfigCommand());
  cmd.addCommand(createTraceCommand());
  cmd.addCommand(createDecisionsCommand());
  return cmd;
}
