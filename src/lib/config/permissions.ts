import type { ValidationResult } from "./validate";

export interface ParsedRule {
  ok: true;
  tool: string;
  specifier?: string;
}

export interface ParseRuleError {
  ok: false;
  problem: string;
}

export type ParseRuleResult = ParsedRule | ParseRuleError;

export interface ParsedPermissions {
  ok: true;
  allow: string[];
  ask: string[];
  deny: string[];
}

export interface ParsePermissionsError {
  ok: false;
  problem: string;
}

export type ParsePermissionsResult = ParsedPermissions | ParsePermissionsError;

/** Parses a single permission rule string to extract tool and optional specifier. */
export function parsePermissionRule(rule: string): ParseRuleResult {
  if (!rule || !rule.trim()) {
    return { ok: false, problem: "Rule cannot be empty." };
  }

  const trimmed = rule.trim();

  // `Tool` or `Tool(specifier)`. An MCP tool names its server with underscores —
  // `mcp__playwright__navigate` — so those are part of a tool name, not a syntax error.
  const match = trimmed.match(/^([A-Za-z][A-Za-z0-9_]*)(?: *\((.*)\))?$/);
  if (!match) {
    return { ok: false, problem: `Invalid syntax: ${rule}` };
  }

  const tool = match[1];
  const specifier = match[2];

  // Check for balanced parentheses when specifier is present
  if (specifier === undefined && trimmed.includes("(")) {
    return {
      ok: false,
      problem: `Invalid syntax: unmatched parentheses in ${rule}`,
    };
  }

  return {
    ok: true,
    tool,
    specifier: specifier === undefined ? undefined : specifier.trim(),
  };
}

/** Validates a single permission rule string. */
export function validatePermissionRule(rule: string): ValidationResult {
  const parsed = parsePermissionRule(rule);
  if (!parsed.ok) {
    return { ok: false, problem: parsed.problem };
  }
  return { ok: true };
}

/** Parses a permissions object into allow, ask, deny arrays. */
export function parsePermissionsObject(value: unknown): ParsePermissionsResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, problem: "Permissions must be an object." };
  }

  const obj = value as Record<string, unknown>;

  const allow = Array.isArray(obj.allow) ? obj.allow.map(String) : [];
  const ask = Array.isArray(obj.ask) ? obj.ask.map(String) : [];
  const deny = Array.isArray(obj.deny) ? obj.deny.map(String) : [];

  // Check that all three are actually arrays if present
  if (obj.allow !== undefined && !Array.isArray(obj.allow)) {
    return {
      ok: false,
      problem: "permissions.allow must be an array of rules.",
    };
  }
  if (obj.ask !== undefined && !Array.isArray(obj.ask)) {
    return { ok: false, problem: "permissions.ask must be an array of rules." };
  }
  if (obj.deny !== undefined && !Array.isArray(obj.deny)) {
    return {
      ok: false,
      problem: "permissions.deny must be an array of rules.",
    };
  }

  return { ok: true, allow, ask, deny };
}

/** Validates a permissions object and all its rules. */
export function validatePermissionsObject(value: unknown): ValidationResult {
  const parsed = parsePermissionsObject(value);
  if (!parsed.ok) {
    return { ok: false, problem: parsed.problem };
  }

  const { allow, ask, deny } = parsed;

  // Validate each rule in each list
  for (const rule of allow) {
    const validation = validatePermissionRule(rule);
    if (!validation.ok) {
      return {
        ok: false,
        problem: `Invalid rule in permissions.allow: ${rule} — ${validation.problem}`,
      };
    }
  }

  for (const rule of ask) {
    const validation = validatePermissionRule(rule);
    if (!validation.ok) {
      return {
        ok: false,
        problem: `Invalid rule in permissions.ask: ${rule} — ${validation.problem}`,
      };
    }
  }

  for (const rule of deny) {
    const validation = validatePermissionRule(rule);
    if (!validation.ok) {
      return {
        ok: false,
        problem: `Invalid rule in permissions.deny: ${rule} — ${validation.problem}`,
      };
    }
  }

  return { ok: true };
}

/** Assembles allow, ask, deny arrays back into a permissions object. */
export function assemblePermissionsObject(
  allow: string[],
  ask: string[],
  deny: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (allow.length > 0) {
    result.allow = allow;
  }
  if (ask.length > 0) {
    result.ask = ask;
  }
  if (deny.length > 0) {
    result.deny = deny;
  }

  return Object.keys(result).length === 0 ? {} : result;
}
