import { describe, expect, test } from "bun:test";
import {
  parsePermissionRule,
  parsePermissionsObject,
  validatePermissionRule,
  validatePermissionsObject,
  type ParseRuleError,
} from "./permissions";

describe("parsePermissionRule", () => {
  test("parses a simple tool name", () => {
    const result = parsePermissionRule("Bash");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tool).toBe("Bash");
      expect(result.specifier).toBeUndefined();
    }
  });

  test("parses a tool with specifier", () => {
    const result = parsePermissionRule("Read(./.env)");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tool).toBe("Read");
      expect(result.specifier).toBe("./.env");
    }
  });

  test("parses a tool with complex specifier", () => {
    const result = parsePermissionRule("Bash(npm run *)");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tool).toBe("Bash");
      expect(result.specifier).toBe("npm run *");
    }
  });

  test("parses a tool with domain specifier", () => {
    const result = parsePermissionRule("WebFetch(domain:example.com)");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tool).toBe("WebFetch");
      expect(result.specifier).toBe("domain:example.com");
    }
  });

  test("rejects malformed rules", () => {
    expect(parsePermissionRule("").ok).toBe(false);
    expect(parsePermissionRule("Tool(").ok).toBe(false);
    expect(parsePermissionRule("Tool)").ok).toBe(false);
    expect(parsePermissionRule("123").ok).toBe(false);
  });
});

describe("validatePermissionRule", () => {
  test("accepts valid rules", () => {
    expect(validatePermissionRule("Bash").ok).toBe(true);
    expect(validatePermissionRule("Read(./.env)").ok).toBe(true);
    expect(validatePermissionRule("WebFetch(domain:example.com)").ok).toBe(
      true
    );
  });

  test("rejects empty rule", () => {
    const result = validatePermissionRule("");
    expect(result.ok).toBe(false);
    expect((result as ParseRuleError).problem).toBeDefined();
  });

  test("rejects malformed rule with message", () => {
    const result = validatePermissionRule("Tool(");
    expect(result.ok).toBe(false);
    expect((result as ParseRuleError).problem).toContain("Invalid syntax");
  });

  test("rejects rule with unmatched parentheses", () => {
    const result = validatePermissionRule("Tool(spec");
    expect(result.ok).toBe(false);
  });
});

describe("parsePermissionsObject", () => {
  test("parses a valid permissions object", () => {
    const obj = {
      allow: ["Bash", "Read(./.env)"],
      ask: ["WebFetch(domain:example.com)"],
      deny: ["PowerShell"],
    };
    const result = parsePermissionsObject(obj);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.allow).toEqual(["Bash", "Read(./.env)"]);
      expect(result.ask).toEqual(["WebFetch(domain:example.com)"]);
      expect(result.deny).toEqual(["PowerShell"]);
    }
  });

  test("handles missing lists", () => {
    const obj = {
      allow: ["Bash"],
    };
    const result = parsePermissionsObject(obj);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.allow).toEqual(["Bash"]);
      expect(result.ask).toEqual([]);
      expect(result.deny).toEqual([]);
    }
  });

  test("handles empty object", () => {
    const result = parsePermissionsObject({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.allow).toEqual([]);
      expect(result.ask).toEqual([]);
      expect(result.deny).toEqual([]);
    }
  });

  test("handles non-object input", () => {
    expect(parsePermissionsObject(null).ok).toBe(false);
    expect(parsePermissionsObject(undefined).ok).toBe(false);
    expect(parsePermissionsObject("string").ok).toBe(false);
    expect(parsePermissionsObject([]).ok).toBe(false);
  });

  test("rejects non-array values", () => {
    const obj = {
      allow: "not an array",
    };
    const result = parsePermissionsObject(obj as Record<string, unknown>);
    expect(result.ok).toBe(false);
  });
});

describe("validatePermissionsObject", () => {
  test("accepts a valid object with all lists", () => {
    const obj = {
      allow: ["Bash"],
      ask: ["WebFetch"],
      deny: ["PowerShell"],
    };
    const result = validatePermissionsObject(obj);
    expect(result.ok).toBe(true);
  });

  test("rejects object with invalid rule", () => {
    const obj = {
      allow: ["Bash"],
      ask: ["Invalid("],
    };
    const result = validatePermissionsObject(obj);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem).toContain("ask");
    }
  });

  test("rejects object with non-array values", () => {
    const obj = {
      allow: "Bash",
    };
    const result = validatePermissionsObject(obj as Record<string, unknown>);
    expect(result.ok).toBe(false);
  });
});

describe("MCP tool rules", () => {
  test("an MCP tool's underscores are part of its name, not a syntax error", () => {
    const parsed = parsePermissionRule("mcp__playwright__browser_navigate");
    expect(parsed.ok).toBe(true);
    expect(validatePermissionRule("mcp__playwright").ok).toBe(true);
  });
});
