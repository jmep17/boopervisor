import type { ValidationResult } from "./validate";

/** One action Claude Code runs. Only `command` hooks are edited as a form; the rest are preserved as found. */
export interface HookAction {
  type: string;
  command?: string;
  timeout?: number;
  [field: string]: unknown;
}

/** A `{ matcher, hooks }` group. `matcher` is optional: absent or "*" means every occurrence. */
export interface HookGroup {
  matcher?: string;
  hooks: HookAction[];
  [field: string]: unknown;
}

export type HooksByEvent = Record<string, HookGroup[]>;

export interface ParsedHooks {
  ok: true;
  hooks: HooksByEvent;
}

export interface ParseHooksError {
  ok: false;
  problem: string;
}

export type ParseHooksResult = ParsedHooks | ParseHooksError;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parses one hook action. `command` hooks are checked; everything else is kept as found. */
function parseHookAction(
  actionValue: unknown,
  event: string,
  groupIndex: number,
  actionIndex: number
): { ok: true; action: HookAction } | ParseHooksError {
  const where = `hooks.${event}[${groupIndex}].hooks[${actionIndex}]`;

  if (!isPlainObject(actionValue) || typeof actionValue.type !== "string") {
    return { ok: false, problem: `${where} must have a string "type".` };
  }

  if (actionValue.type === "command") {
    if (typeof actionValue.command !== "string" || actionValue.command === "") {
      return { ok: false, problem: `${where} must have a command.` };
    }
    if (
      actionValue.timeout !== undefined &&
      (typeof actionValue.timeout !== "number" ||
        !Number.isFinite(actionValue.timeout))
    ) {
      return { ok: false, problem: `${where} timeout must be a number.` };
    }
  }

  return {
    ok: true,
    action: { ...actionValue, type: actionValue.type } as HookAction,
  };
}

/** Parses one `{ matcher, hooks }` group. */
function parseHookGroup(
  groupValue: unknown,
  event: string,
  groupIndex: number
): { ok: true; group: HookGroup } | ParseHooksError {
  const where = `hooks.${event}[${groupIndex}]`;

  if (!isPlainObject(groupValue) || !Array.isArray(groupValue.hooks)) {
    return {
      ok: false,
      problem: `${where} is not a { "matcher", "hooks" } group.`,
    };
  }

  if (
    groupValue.matcher !== undefined &&
    typeof groupValue.matcher !== "string"
  ) {
    return { ok: false, problem: `${where} matcher must be a string.` };
  }

  const actions: HookAction[] = [];
  for (
    let actionIndex = 0;
    actionIndex < groupValue.hooks.length;
    actionIndex++
  ) {
    const parsed = parseHookAction(
      groupValue.hooks[actionIndex],
      event,
      groupIndex,
      actionIndex
    );
    if (!parsed.ok) return parsed;
    actions.push(parsed.action);
  }

  const rest = { ...groupValue };
  delete rest.hooks;
  return { ok: true, group: { ...rest, hooks: actions } as HookGroup };
}

/** Parses a hooks object into the documented event → { matcher, hooks } shape. */
export function parseHooksObject(value: unknown): ParseHooksResult {
  if (value === undefined) {
    return { ok: true, hooks: {} };
  }

  if (!isPlainObject(value)) {
    return { ok: false, problem: "hooks must be an object keyed by event." };
  }

  const hooks: HooksByEvent = {};

  for (const [event, groupsValue] of Object.entries(value)) {
    if (!Array.isArray(groupsValue)) {
      return { ok: false, problem: `hooks.${event} must be an array.` };
    }

    const groups: HookGroup[] = [];
    // An event the catalog does not know is preserved, not refused — Claude Code may
    // document events we haven't caught up to yet, and the file should still round-trip.
    for (let groupIndex = 0; groupIndex < groupsValue.length; groupIndex++) {
      const parsed = parseHookGroup(groupsValue[groupIndex], event, groupIndex);
      if (!parsed.ok) return parsed;
      groups.push(parsed.group);
    }

    hooks[event] = groups;
  }

  return { ok: true, hooks };
}

/** Validates a hooks object against the documented shape. */
export function validateHooksObject(value: unknown): ValidationResult {
  const parsed = parseHooksObject(value);
  if (!parsed.ok) {
    return { ok: false, problem: parsed.problem };
  }
  return { ok: true };
}

/** Assembles the event → { matcher, hooks } map back into the object Claude Code reads. */
export function assembleHooksObject(
  hooks: HooksByEvent
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [event, groups] of Object.entries(hooks)) {
    const assembledGroups = groups
      .filter((group) => group.hooks.length > 0)
      .map((group) => {
        const { matcher, hooks: actions, ...rest } = group;
        return {
          ...rest,
          ...(matcher ? { matcher } : {}),
          hooks: actions,
        };
      });

    if (assembledGroups.length > 0) {
      result[event] = assembledGroups;
    }
  }

  return result;
}
