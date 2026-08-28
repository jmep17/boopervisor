import type { SettingDefinition } from "@/lib/catalog";
import { validatePermissionsObject } from "./permissions";
import { validateHooksObject } from "./hooks";

/** Result of validating a value against a setting definition. */
export type ValidationResult = ValidationOk | ValidationError;

export interface ValidationOk {
  ok: true;
}

export interface ValidationError {
  ok: false;
  problem: string;
}

/**
 * Validates a value against a setting's definition. The catalog provides
 * the type, enumerated values if any, and other constraints.
 *
 * Returns a typed result rather than throwing for expected failures.
 * Error messages name the specific problem.
 */
export function validateSetting(
  value: unknown,
  setting: SettingDefinition
): ValidationResult {
  // Special validation for keys with purpose-built editors
  if (
    setting.key === "permissions.allow" ||
    setting.key === "permissions.ask" ||
    setting.key === "permissions.deny"
  ) {
    // These are arrays of permission rules
    if (!Array.isArray(value)) {
      return {
        ok: false,
        problem: `Expected array of rules, got ${typeof value}`,
      };
    }
    // Validate as part of a permissions object
    // Create a mock permissions object with just this array
    const mockPerms: Record<string, unknown> = {};
    const key = setting.key.split(".")[1]; // "allow", "ask", or "deny"
    mockPerms[key] = value;
    return validatePermissionsObject(mockPerms);
  }

  if (setting.key === "hooks") {
    return validateHooksObject(value);
  }

  // For now, handle simple validation: type checking and enum constraints
  // Tickets 05/06/07 will extend this for complex shapes

  const { valueType, enumValues } = setting;

  // Check type match
  switch (valueType) {
    case "boolean":
      if (typeof value !== "boolean") {
        return { ok: false, problem: `Expected boolean, got ${typeof value}` };
      }
      break;

    case "string":
      if (typeof value !== "string") {
        return { ok: false, problem: `Expected string, got ${typeof value}` };
      }
      // Check enum constraints if applicable
      if (enumValues.length > 0 && !enumValues.includes(value)) {
        return {
          ok: false,
          problem: `Must be one of: ${enumValues.join(", ")}`,
        };
      }
      break;

    case "number":
      if (typeof value !== "number") {
        return { ok: false, problem: `Expected number, got ${typeof value}` };
      }
      break;

    case "array":
      if (!Array.isArray(value)) {
        return { ok: false, problem: `Expected array, got ${typeof value}` };
      }
      break;

    case "object":
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return { ok: false, problem: `Expected object, got ${typeof value}` };
      }
      break;

    case "unknown":
      // No validation for unknown types
      break;
  }

  return { ok: true };
}

/**
 * Type guard to check if a value is a ValidationOk.
 */
export function isValidationOk(
  result: ValidationResult
): result is ValidationOk {
  return result.ok;
}
