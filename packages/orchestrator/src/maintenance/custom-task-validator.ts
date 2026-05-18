import type { CustomTaskDefinition } from '@harness-engineering/types';
import { Ok, Err, type Result } from '@harness-engineering/types';
import type { TaskDefinition, TaskType } from './types';

/**
 * Hermes Phase 2 — Validation errors surfaced by `validateCustomTasks`.
 *
 * `path` always begins with `customTasks.<taskId>` so the caller can render
 * it directly without re-prefixing. Multiple errors may be returned in a
 * single call; the validator does not short-circuit on the first failure.
 */
export interface CustomTaskValidationError {
  path: string;
  message: string;
}

export interface CustomTaskValidatorDeps {
  /** Returns true if a skill with this name exists in the project's registry. */
  skillExists?: (name: string) => boolean;
  /** Returns true if the executable referenced by a checkScript.path exists. */
  scriptExists?: (path: string) => boolean;
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

const REQUIRED_FIELDS_BY_TYPE: Record<TaskType, (keyof CustomTaskDefinition)[]> = {
  'mechanical-ai': ['branch', 'fixSkill'],
  'pure-ai': ['branch', 'fixSkill'],
  'report-only': [],
  housekeeping: [],
};

/**
 * Validates a `MaintenanceConfig.customTasks` map.
 *
 * Checks:
 *  - kebab-case task IDs (matching the BUILT_IN_TASKS convention)
 *  - no collision with built-in IDs
 *  - per-type required fields (e.g., mechanical-ai must have `branch` + `fixSkill`)
 *  - exactly one of `checkCommand` / `checkScript` for types that need a check step
 *  - `contextFrom` cycle detection across the merged graph (built-ins + customs)
 *  - `contextFrom` entries reference existing task IDs
 *  - `inlineSkills` entries exist in the skill registry (when `skillExists` is provided)
 *  - `checkScript.path` exists on disk (when `scriptExists` is provided)
 *
 * Returns `Ok(void)` when all custom tasks pass; otherwise an `Err` carrying
 * every distinct violation. The validator is pure: no I/O outside the
 * injected predicates.
 */
export function validateCustomTasks(
  customTasks: Record<string, CustomTaskDefinition> | undefined,
  builtIns: readonly TaskDefinition[],
  deps: CustomTaskValidatorDeps = {}
): Result<void, CustomTaskValidationError[]> {
  const errors: CustomTaskValidationError[] = [];

  if (!customTasks) return Ok(undefined as void);

  const builtInIds = new Set(builtIns.map((t) => t.id));
  const customIds = Object.keys(customTasks);
  const allIds = new Set<string>([...builtInIds, ...customIds]);

  for (const id of customIds) {
    const task = customTasks[id];
    if (!task) continue;
    validateOne(id, task, builtInIds, allIds, deps, errors);
  }

  detectCycles(customTasks, builtIns, errors);

  return errors.length === 0 ? Ok(undefined as void) : Err(errors);
}

function validateOne(
  id: string,
  task: CustomTaskDefinition,
  builtInIds: Set<string>,
  allIds: Set<string>,
  deps: CustomTaskValidatorDeps,
  errors: CustomTaskValidationError[]
): void {
  const prefix = `customTasks.${id}`;

  if (!ID_PATTERN.test(id)) {
    errors.push({
      path: prefix,
      message: `task ID '${id}' must match ^[a-z0-9][a-z0-9-]*$`,
    });
  }
  if (builtInIds.has(id)) {
    errors.push({
      path: prefix,
      message: `task ID '${id}' collides with a built-in task; choose a different name`,
    });
  }
  if (!task.description || task.description.trim().length === 0) {
    errors.push({ path: `${prefix}.description`, message: 'description is required' });
  }
  if (!task.schedule || task.schedule.trim().length === 0) {
    errors.push({ path: `${prefix}.schedule`, message: 'schedule (cron expression) is required' });
  }
  validateCheckShape(prefix, task, errors);
  validateRequiredByType(prefix, task, errors);
  validateContextFrom(prefix, id, task, allIds, errors);
  validateInlineSkills(prefix, task, deps, errors);
  validateScriptPath(prefix, task, deps, errors);
}

function validateCheckShape(
  prefix: string,
  task: CustomTaskDefinition,
  errors: CustomTaskValidationError[]
): void {
  const hasCommand = Array.isArray(task.checkCommand) && task.checkCommand.length > 0;
  const hasScript = task.checkScript !== undefined;

  if (hasCommand && hasScript) {
    errors.push({
      path: prefix,
      message: 'a task may declare checkCommand OR checkScript, not both',
    });
  }
  const needsCheck =
    task.type === 'mechanical-ai' || task.type === 'report-only' || task.type === 'housekeeping';
  if (needsCheck && !hasCommand && !hasScript) {
    errors.push({
      path: prefix,
      message: `${task.type} task must declare either checkCommand or checkScript`,
    });
  }
  if (hasScript) {
    const path = task.checkScript?.path;
    if (!path || path.trim().length === 0) {
      errors.push({ path: `${prefix}.checkScript.path`, message: 'checkScript.path is required' });
    }
    if (task.checkScript?.timeoutMs !== undefined && task.checkScript.timeoutMs <= 0) {
      errors.push({
        path: `${prefix}.checkScript.timeoutMs`,
        message: 'timeoutMs must be a positive integer',
      });
    }
  }
}

function validateRequiredByType(
  prefix: string,
  task: CustomTaskDefinition,
  errors: CustomTaskValidationError[]
): void {
  const required = REQUIRED_FIELDS_BY_TYPE[task.type];
  if (!required) {
    errors.push({ path: `${prefix}.type`, message: `unknown task type '${String(task.type)}'` });
    return;
  }
  for (const field of required) {
    const value = task[field];
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.length === 0)
    ) {
      errors.push({
        path: `${prefix}.${String(field)}`,
        message: `${task.type} task requires ${String(field)}`,
      });
    }
  }
  if ((task.type === 'mechanical-ai' || task.type === 'pure-ai') && task.branch === null) {
    errors.push({
      path: `${prefix}.branch`,
      message: `${task.type} task requires a non-null branch`,
    });
  }
}

function validateContextFrom(
  prefix: string,
  selfId: string,
  task: CustomTaskDefinition,
  allIds: Set<string>,
  errors: CustomTaskValidationError[]
): void {
  if (task.contextFromMaxAgeMinutes !== undefined && task.contextFromMaxAgeMinutes <= 0) {
    errors.push({
      path: `${prefix}.contextFromMaxAgeMinutes`,
      message: 'contextFromMaxAgeMinutes must be a positive integer',
    });
  }
  if (!task.contextFrom) return;
  for (let i = 0; i < task.contextFrom.length; i++) {
    const upstreamId = task.contextFrom[i];
    if (!upstreamId) continue;
    if (upstreamId === selfId) {
      errors.push({
        path: `${prefix}.contextFrom[${i}]`,
        message: `task '${selfId}' cannot reference itself in contextFrom`,
      });
    }
    if (!allIds.has(upstreamId)) {
      errors.push({
        path: `${prefix}.contextFrom[${i}]`,
        message: `references unknown task '${upstreamId}'`,
      });
    }
  }
}

function validateInlineSkills(
  prefix: string,
  task: CustomTaskDefinition,
  deps: CustomTaskValidatorDeps,
  errors: CustomTaskValidationError[]
): void {
  if (!task.inlineSkills) return;
  if (!deps.skillExists) return;
  for (let i = 0; i < task.inlineSkills.length; i++) {
    const name = task.inlineSkills[i];
    if (!name) continue;
    if (!deps.skillExists(name)) {
      errors.push({
        path: `${prefix}.inlineSkills[${i}]`,
        message: `skill '${name}' not found in the registry`,
      });
    }
  }
  if (task.inlineSkillsBudgetTokens !== undefined && task.inlineSkillsBudgetTokens <= 0) {
    errors.push({
      path: `${prefix}.inlineSkillsBudgetTokens`,
      message: 'inlineSkillsBudgetTokens must be a positive integer',
    });
  }
}

function validateScriptPath(
  prefix: string,
  task: CustomTaskDefinition,
  deps: CustomTaskValidatorDeps,
  errors: CustomTaskValidationError[]
): void {
  if (!task.checkScript?.path) return;
  if (!deps.scriptExists) return;
  if (!deps.scriptExists(task.checkScript.path)) {
    errors.push({
      path: `${prefix}.checkScript.path`,
      message: `executable not found: ${task.checkScript.path}`,
    });
  }
}

/**
 * DFS cycle detection over the `contextFrom` graph. Built-in tasks count as
 * leaf nodes (they have no `contextFrom`). Each detected cycle is emitted
 * once with its full path.
 */
function detectCycles(
  customTasks: Record<string, CustomTaskDefinition>,
  builtIns: readonly TaskDefinition[],
  errors: CustomTaskValidationError[]
): void {
  type Color = 'white' | 'grey' | 'black';
  const adjacency = new Map<string, string[]>();

  for (const t of builtIns) adjacency.set(t.id, []);
  for (const [id, task] of Object.entries(customTasks)) {
    adjacency.set(id, (task.contextFrom ?? []).slice());
  }

  const color = new Map<string, Color>();
  for (const id of adjacency.keys()) color.set(id, 'white');

  const reported = new Set<string>();
  for (const id of Object.keys(customTasks)) {
    if (color.get(id) === 'white') visitFromRoot(id, adjacency, color, errors, reported);
  }
}

interface VisitFrame {
  id: string;
  nextIdx: number;
  path: string[];
}

function visitFromRoot(
  start: string,
  adjacency: Map<string, string[]>,
  color: Map<string, 'white' | 'grey' | 'black'>,
  errors: CustomTaskValidationError[],
  reported: Set<string>
): void {
  const stack: VisitFrame[] = [{ id: start, nextIdx: 0, path: [start] }];
  color.set(start, 'grey');
  while (stack.length) {
    const top = stack[stack.length - 1]!;
    const neighbors = adjacency.get(top.id) ?? [];
    if (top.nextIdx >= neighbors.length) {
      color.set(top.id, 'black');
      stack.pop();
      continue;
    }
    const next = neighbors[top.nextIdx++];
    if (!next || !adjacency.has(next)) continue;
    handleEdge(top, next, color, stack, errors, reported);
  }
}

function handleEdge(
  top: VisitFrame,
  next: string,
  color: Map<string, 'white' | 'grey' | 'black'>,
  stack: VisitFrame[],
  errors: CustomTaskValidationError[],
  reported: Set<string>
): void {
  const nextColor = color.get(next);
  if (nextColor === 'grey') {
    reportCycle(top.path, next, errors, reported);
  } else if (nextColor === 'white') {
    color.set(next, 'grey');
    stack.push({ id: next, nextIdx: 0, path: [...top.path, next] });
  }
}

function reportCycle(
  path: string[],
  next: string,
  errors: CustomTaskValidationError[],
  reported: Set<string>
): void {
  const cycleStart = path.indexOf(next);
  const cyclePath = cycleStart >= 0 ? [...path.slice(cycleStart), next] : [...path, next];
  const key = cyclePath.join('→');
  if (reported.has(key)) return;
  reported.add(key);
  errors.push({
    path: `customTasks.${cyclePath[0]}.contextFrom`,
    message: `contextFrom cycle detected: ${cyclePath.join(' → ')}`,
  });
}
