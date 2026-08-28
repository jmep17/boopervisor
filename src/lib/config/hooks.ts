import type { ValidationResult } from "./validate";

export interface HookEntry {
  event: string;
  matcher: string;
  command: string;
}

export interface ParsedHooks {
  ok: true;
  hooks: Record<string, Array<{ matcher: string; command: string }>>;
}

export interface ParseHooksError {
  ok: false;
  problem: string;
}

export type ParseHooksResult = ParsedHooks | ParseHooksError;

/** Validates a single hook entry has all required fields. */
export function validateHookEntry(entry: unknown): ValidationResult {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return { ok: false, problem: "Hook entry must be an object." };
  }

  const obj = entry as Record<string, unknown>;

  // Check required fields
  if (typeof obj.event !== "string") {
    return { ok: false, problem: "Hook entry must have a string event." };
  }

  if (typeof obj.command !== "string") {
    return { ok: false, problem: "Hook entry must have a string command." };
  }

  // matcher is optional, but if present must be a string
  if (obj.matcher !== undefined && typeof obj.matcher !== "string") {
    return { ok: false, problem: "Hook entry matcher must be a string." };
  }

  return { ok: true };
}

/** Parses a hooks object into event → entries map. */
export function parseHooksObject(value: unknown): ParseHooksResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, problem: "Hooks must be an object keyed by event." };
  }

  const obj = value as Record<string, unknown>;
  const hooks: Record<string, Array<{ matcher: string; command: string }>> = {};

  for (const [event, entries] of Object.entries(obj)) {
    if (!Array.isArray(entries)) {
      return { ok: false, problem: `Hooks[${event}] must be an array.` };
    }

    const hookEntries: Array<{ matcher: string; command: string }> = [];
    for (const entry of entries) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return {
          ok: false,
          problem: `Hook entry in ${event} must be an object.`,
        };
      }

      const entryObj = entry as Record<string, unknown>;
      if (typeof entryObj.command !== "string") {
        return {
          ok: false,
          problem: `Hook entry in ${event} must have a command.`,
        };
      }

      const matcher = entryObj.matcher ?? "";
      if (typeof matcher !== "string") {
        return {
          ok: false,
          problem: `Hook entry in ${event} matcher must be a string.`,
        };
      }

      hookEntries.push({
        matcher,
        command: entryObj.command,
      });
    }

    if (hookEntries.length > 0) {
      hooks[event] = hookEntries;
    }
  }

  return { ok: true, hooks };
}

/** Validates a hooks object and all its entries. */
export function validateHooksObject(value: unknown): ValidationResult {
  const parsed = parseHooksObject(value);
  if (!parsed.ok) {
    return { ok: false, problem: parsed.problem };
  }

  const { hooks } = parsed;

  // Validate each entry
  for (const [event, entries] of Object.entries(hooks)) {
    for (const entry of entries) {
      const validation = validateHookEntry({
        event,
        ...entry,
      });
      if (!validation.ok) {
        return {
          ok: false,
          problem: `Invalid hook entry in ${event}: ${validation.problem}`,
        };
      }
    }
  }

  return { ok: true };
}

/** Assembles event → entries map back into a hooks object. */
export function assembleHooksObject(
  hooks: Record<string, Array<{ matcher: string; command: string }>>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [event, entries] of Object.entries(hooks)) {
    if (entries.length > 0) {
      result[event] = entries;
    }
  }

  return result;
}
