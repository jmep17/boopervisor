import { describe, expect, test } from "bun:test";
import {
  parseHooksObject,
  validateHooksObject,
  validateHookEntry,
} from "./hooks";
import type { ValidationResult } from "./validate";

/** The message a refusal names its problem with; empty when the value was accepted. */
function problemOf(result: ValidationResult): string {
  return result.ok ? "" : result.problem;
}

describe("validateHookEntry", () => {
  test("accepts a valid hook entry with required fields", () => {
    const entry = {
      event: "SessionStart",
      matcher: "",
      command: "/path/to/script.sh",
    };
    const result = validateHookEntry(entry);
    expect(result.ok).toBe(true);
  });

  test("accepts a hook entry with matcher", () => {
    const entry = {
      event: "UserPromptSubmit",
      matcher: "deploy",
      command: "/path/to/deploy.sh",
    };
    const result = validateHookEntry(entry);
    expect(result.ok).toBe(true);
  });

  test("rejects entry missing event", () => {
    const entry = {
      matcher: "",
      command: "/path/to/script.sh",
    };
    const result = validateHookEntry(entry as Record<string, unknown>);
    expect(result.ok).toBe(false);
    expect(problemOf(result)).toContain("event");
  });

  test("rejects entry missing command", () => {
    const entry = {
      event: "SessionStart",
      matcher: "",
    };
    const result = validateHookEntry(entry as Record<string, unknown>);
    expect(result.ok).toBe(false);
    expect(problemOf(result)).toContain("command");
  });

  test("rejects entry with non-string event", () => {
    const entry = {
      event: 123,
      matcher: "",
      command: "/path/to/script.sh",
    };
    const result = validateHookEntry(entry as Record<string, unknown>);
    expect(result.ok).toBe(false);
  });

  test("rejects entry with non-string command", () => {
    const entry = {
      event: "SessionStart",
      matcher: "",
      command: 123,
    };
    const result = validateHookEntry(entry as Record<string, unknown>);
    expect(result.ok).toBe(false);
  });
});

describe("parseHooksObject", () => {
  test("parses a valid hooks object", () => {
    const obj = {
      SessionStart: [{ matcher: "", command: "/path/to/script.sh" }],
      UserPromptSubmit: [{ matcher: "deploy", command: "/path/to/deploy.sh" }],
    };
    const result = parseHooksObject(obj);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.hooks).length).toBe(2);
      expect(result.hooks.SessionStart).toBeDefined();
      expect(result.hooks.UserPromptSubmit).toBeDefined();
    }
  });

  test("handles empty object", () => {
    const result = parseHooksObject({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.hooks).length).toBe(0);
    }
  });

  test("rejects non-object input", () => {
    expect(parseHooksObject(null).ok).toBe(false);
    expect(parseHooksObject(undefined).ok).toBe(false);
    expect(parseHooksObject("string").ok).toBe(false);
    expect(parseHooksObject([]).ok).toBe(false);
  });

  test("rejects event with non-array value", () => {
    const obj = {
      SessionStart: "not an array",
    };
    const result = parseHooksObject(obj as Record<string, unknown>);
    expect(result.ok).toBe(false);
  });

  test("validates all entries in all events", () => {
    const obj = {
      SessionStart: [
        { matcher: "", command: "/path/to/script.sh" },
        { event: "SessionStart", matcher: "", command: "/path/to/other.sh" },
      ],
    };
    const result = parseHooksObject(obj);
    // The entries should be extracted as { matcher, command } pairs
    expect(result.ok).toBe(true);
  });
});

describe("validateHooksObject", () => {
  test("accepts a valid hooks object", () => {
    const obj = {
      SessionStart: [
        { event: "SessionStart", matcher: "", command: "/path/to/script.sh" },
      ],
    };
    const result = validateHooksObject(obj);
    expect(result.ok).toBe(true);
  });

  test("rejects object with invalid entry in event", () => {
    const obj = {
      SessionStart: [
        { event: "SessionStart", matcher: "", command: "/path/to/script.sh" },
        { event: "SessionStart", matcher: "" }, // Missing command
      ],
    };
    const result = validateHooksObject(obj);
    expect(result.ok).toBe(false);
  });

  test("rejects object with non-object entry", () => {
    const obj = {
      SessionStart: ["not an object"],
    };
    const result = validateHooksObject(obj as Record<string, unknown>);
    expect(result.ok).toBe(false);
  });

  test("validates all entries across all events", () => {
    const obj = {
      SessionStart: [
        { event: "SessionStart", matcher: "", command: "/path/to/script.sh" },
      ],
      UserPromptSubmit: [
        {
          event: "UserPromptSubmit",
          matcher: "deploy",
          command: "/path/to/deploy.sh",
        },
      ],
    };
    const result = validateHooksObject(obj);
    expect(result.ok).toBe(true);
  });
});
