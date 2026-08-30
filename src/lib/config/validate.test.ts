import { describe, expect, test } from "bun:test";
import { validateSetting, isValidationOk } from "./validate";
import { getSetting } from "@/lib/catalog";
import type { SettingDefinition } from "@/lib/catalog";

// Helper to create a test setting definition
function createSetting(
  overrides: Partial<SettingDefinition>
): SettingDefinition {
  return {
    key: "test",
    topic: "Test",
    summary: "A test setting",
    scopes: ["user", "project", "local", "managed"],
    valueType: "string",
    enumValues: [],
    typeText: "test",
    defaultText: "none",
    perSessionOverrides: "none",
    docUrl: "http://example.com",
    control: "text",
    suggestions: [],
    virtual: false,
    dangerous: false,
    ...overrides,
  };
}

describe("validateSetting", () => {
  test("accepts valid boolean values", () => {
    const setting = createSetting({ valueType: "boolean" });
    expect(validateSetting(true, setting)).toEqual({ ok: true });
    expect(validateSetting(false, setting)).toEqual({ ok: true });
  });

  test("rejects non-boolean for boolean setting", () => {
    const setting = createSetting({ valueType: "boolean" });
    const result = validateSetting("true", setting);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem).toContain("Expected boolean");
    }
  });

  test("accepts valid string values", () => {
    const setting = createSetting({ valueType: "string" });
    expect(validateSetting("hello", setting)).toEqual({ ok: true });
    expect(validateSetting("", setting)).toEqual({ ok: true });
  });

  test("rejects non-string for string setting", () => {
    const setting = createSetting({ valueType: "string" });
    const result = validateSetting(123, setting);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem).toContain("Expected string");
    }
  });

  test("validates enum constraints", () => {
    const setting = createSetting({
      valueType: "string",
      enumValues: ["low", "medium", "high"],
    });
    expect(validateSetting("low", setting)).toEqual({ ok: true });
    expect(validateSetting("high", setting)).toEqual({ ok: true });

    const result = validateSetting("invalid", setting);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem).toContain("low");
    }
  });

  test("accepts any string when no enum constraints", () => {
    const setting = createSetting({ valueType: "string", enumValues: [] });
    expect(validateSetting("anything", setting)).toEqual({ ok: true });
    expect(validateSetting("random-value", setting)).toEqual({ ok: true });
  });

  test("accepts valid numbers", () => {
    const setting = createSetting({ valueType: "number" });
    expect(validateSetting(42, setting)).toEqual({ ok: true });
    expect(validateSetting(0, setting)).toEqual({ ok: true });
    expect(validateSetting(-1.5, setting)).toEqual({ ok: true });
  });

  test("rejects non-number for number setting", () => {
    const setting = createSetting({ valueType: "number" });
    const result = validateSetting("42", setting);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem).toContain("Expected number");
    }
  });

  test("accepts arrays", () => {
    const setting = createSetting({ valueType: "array" });
    expect(validateSetting([], setting)).toEqual({ ok: true });
    expect(validateSetting([1, 2, 3], setting)).toEqual({ ok: true });
  });

  test("rejects non-array for array setting", () => {
    const setting = createSetting({ valueType: "array" });
    const result = validateSetting("not an array", setting);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem).toContain("Expected array");
    }
  });

  test("accepts objects", () => {
    const setting = createSetting({ valueType: "object" });
    expect(validateSetting({}, setting)).toEqual({ ok: true });
    expect(validateSetting({ key: "value" }, setting)).toEqual({ ok: true });
  });

  test("rejects non-objects for object setting", () => {
    const setting = createSetting({ valueType: "object" });
    const result = validateSetting("not an object", setting);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem).toContain("Expected object");
    }
  });

  test("rejects arrays for object setting", () => {
    const setting = createSetting({ valueType: "object" });
    const result = validateSetting([1, 2, 3], setting);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem).toContain("Expected object");
    }
  });

  test("rejects null for object setting", () => {
    const setting = createSetting({ valueType: "object" });
    const result = validateSetting(null, setting);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem).toContain("Expected object");
    }
  });

  test("accepts any value for unknown type", () => {
    const setting = createSetting({ valueType: "unknown" });
    expect(validateSetting("anything", setting)).toEqual({ ok: true });
    expect(validateSetting(123, setting)).toEqual({ ok: true });
    expect(validateSetting(null, setting)).toEqual({ ok: true });
  });
});

describe("validateSetting for hooks", () => {
  test("accepts the documented nested shape", () => {
    const setting = getSetting("hooks")!;
    const value = {
      SessionStart: [
        { hooks: [{ type: "command", command: "/x.sh", timeout: 30 }] },
      ],
    };
    expect(validateSetting(value, setting)).toEqual({ ok: true });
  });

  test("rejects the flat { matcher, command } shape", () => {
    const setting = getSetting("hooks")!;
    const value = { SessionStart: [{ matcher: "", command: "/x.sh" }] };
    const result = validateSetting(value, setting);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem).toContain("hooks");
    }
  });
});

describe("isValidationOk", () => {
  test("returns true for ok results", () => {
    expect(isValidationOk({ ok: true })).toBe(true);
  });

  test("returns false for error results", () => {
    expect(isValidationOk({ ok: false, problem: "test" })).toBe(false);
  });
});
