import type { SettingDefinition } from "@/lib/catalog";

import type { ValidationError } from "./validate";

/** A form sends text; the catalog says what that text means. */
export type ParsedValue = { ok: true; value: unknown } | ValidationError;

/**
 * Turns one form field into the value a setting holds. Validation proper happens in the
 * mutation path; this only refuses text that is not the shape it claims to be.
 *
 * `unset` removes the key, which returns the setting to Claude Code's own default.
 */
export function parseValueForSetting(
  text: string | undefined,
  definition: SettingDefinition | undefined,
  unset = false
): ParsedValue {
  if (unset) return { ok: true, value: undefined };
  if (text === undefined) return { ok: true, value: undefined };

  // Special handling for permission rules
  if (
    definition?.key === "permissions.allow" ||
    definition?.key === "permissions.ask" ||
    definition?.key === "permissions.deny"
  ) {
    const parsed = parseJsonValue(text);
    if (!parsed.ok) return parsed;
    // parsed.value is now an array of strings
    return parsed;
  }

  // Special handling for hooks
  if (definition?.key === "hooks") {
    const parsed = parseJsonValue(text);
    if (!parsed.ok) return parsed;
    // parsed.value is now an object with events as keys
    return parsed;
  }

  switch (definition?.valueType) {
    case "boolean":
      if (text === "") return { ok: true, value: undefined };
      return { ok: true, value: text === "true" || text === "on" };
    case "number": {
      const value = Number(text);
      if (text.trim() === "" || Number.isNaN(value)) {
        return { ok: false, problem: `${text} is not a number.` };
      }
      return { ok: true, value };
    }
    case "string":
      return text === ""
        ? { ok: true, value: undefined }
        : { ok: true, value: text };
    case "array":
    case "object":
    case "unknown":
    case undefined:
      return parseJsonValue(text);
  }
}

/** Uncatalogued keys and structured values are edited as JSON, so they are parsed as JSON. */
export function parseJsonValue(text: string): ParsedValue {
  if (text.trim() === "") return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return {
      ok: false,
      problem: `Not valid JSON: ${(error as Error).message}`,
    };
  }
}
