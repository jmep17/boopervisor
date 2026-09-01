import { describe, expect, test } from "bun:test";
import {
  assembleHooksObject,
  parseHooksObject,
  validateHooksObject,
} from "./hooks";
import type { ValidationResult } from "./validate";

/** The message a refusal names its problem with; empty when the value was accepted. */
function problemOf(result: ValidationResult): string {
  return result.ok ? "" : result.problem;
}

describe("parseHooksObject", () => {
  test("accepts a documented value", () => {
    const value = {
      SessionStart: [
        { hooks: [{ type: "command", command: "/x.sh", timeout: 30 }] },
      ],
    };
    const result = parseHooksObject(value);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hooks.SessionStart[0].hooks[0].timeout).toBe(30);
    }
  });

  test("accepts a matcher on a tool event", () => {
    const value = {
      PreToolUse: [
        { matcher: "Bash", hooks: [{ type: "command", command: "echo hi" }] },
      ],
    };
    const result = parseHooksObject(value);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hooks.PreToolUse[0].matcher).toBe("Bash");
    }
  });

  test("preserves a non-command hook and its fields", () => {
    const value = {
      Stop: [{ hooks: [{ type: "prompt", prompt: "Check", model: "haiku" }] }],
    };
    const result = parseHooksObject(value);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(assembleHooksObject(result.hooks)).toEqual(value);
    }
  });

  test("preserves an unknown field on a group and on a hook", () => {
    const value = {
      Stop: [
        {
          note: "kept",
          hooks: [{ type: "command", command: "/x.sh", extra: "kept-too" }],
        },
      ],
    };
    const result = parseHooksObject(value);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(assembleHooksObject(result.hooks)).toEqual(value);
    }
  });

  test("accepts an event the catalog does not list and keeps it", () => {
    const value = {
      SomethingNew: [{ hooks: [{ type: "command", command: "/x.sh" }] }],
    };
    const result = parseHooksObject(value);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hooks.SomethingNew).toBeDefined();
    }
  });

  test("regression: refuses the flat shape", () => {
    const value = {
      SessionStart: [{ matcher: "", command: "/x.sh" }],
    };
    const result = parseHooksObject(value);
    expect(result.ok).toBe(false);
    expect(problemOf(result)).toContain("hooks");
  });

  test("refuses a command hook without command, naming the event", () => {
    const value = {
      SessionStart: [{ hooks: [{ type: "command" }] }],
    };
    const result = parseHooksObject(value);
    expect(result.ok).toBe(false);
    expect(problemOf(result)).toContain("SessionStart");
  });

  test("refuses a hook without a string type", () => {
    const value = {
      SessionStart: [{ hooks: [{ command: "/x.sh" }] }],
    };
    const result = parseHooksObject(value);
    expect(result.ok).toBe(false);
  });

  test("refuses a non-number timeout", () => {
    const value = {
      SessionStart: [
        { hooks: [{ type: "command", command: "/x.sh", timeout: "soon" }] },
      ],
    };
    const result = parseHooksObject(value);
    expect(result.ok).toBe(false);
  });

  test("refuses a non-array event value", () => {
    const value = { SessionStart: "not an array" };
    const result = parseHooksObject(value as Record<string, unknown>);
    expect(result.ok).toBe(false);
  });

  test("refuses a non-object top level", () => {
    expect(parseHooksObject(null).ok).toBe(false);
    expect(parseHooksObject("string").ok).toBe(false);
    expect(parseHooksObject([]).ok).toBe(false);
  });

  test("undefined and {} parse to {}", () => {
    const undefinedResult = parseHooksObject(undefined);
    expect(undefinedResult.ok).toBe(true);
    if (undefinedResult.ok) expect(undefinedResult.hooks).toEqual({});

    const emptyResult = parseHooksObject({});
    expect(emptyResult.ok).toBe(true);
    if (emptyResult.ok) expect(emptyResult.hooks).toEqual({});
  });

  test("round-trip: a real-world value survives unchanged", () => {
    const value = {
      SessionStart: [
        {
          hooks: [
            {
              type: "command",
              command: "python3 ~/.claude/hooks/x.py",
              timeout: 30,
            },
          ],
        },
      ],
    };
    const result = parseHooksObject(value);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(assembleHooksObject(result.hooks)).toEqual(value);
    }
  });
});

describe("validateHooksObject", () => {
  test("accepts a documented value", () => {
    const value = {
      SessionStart: [
        { hooks: [{ type: "command", command: "/x.sh", timeout: 30 }] },
      ],
    };
    expect(validateHooksObject(value).ok).toBe(true);
  });

  test("rejects the flat shape", () => {
    const value = {
      SessionStart: [{ matcher: "", command: "/x.sh" }],
    };
    const result = validateHooksObject(value);
    expect(result.ok).toBe(false);
    expect(problemOf(result)).toContain("hooks");
  });
});

describe("assembleHooksObject", () => {
  test("drops empty events and empty groups, omits an empty-string matcher", () => {
    const hooks = {
      Empty: [],
      HasEmptyGroup: [{ matcher: "", hooks: [] }],
      Kept: [
        {
          matcher: "",
          hooks: [{ type: "command" as const, command: "/x.sh" }],
        },
      ],
    };
    const assembled = assembleHooksObject(hooks);
    expect(assembled.Empty).toBeUndefined();
    expect(assembled.HasEmptyGroup).toBeUndefined();
    expect(assembled.Kept).toEqual([
      { hooks: [{ type: "command", command: "/x.sh" }] },
    ]);
  });
});
