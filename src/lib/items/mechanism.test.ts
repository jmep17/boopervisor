import { describe, expect, test } from "bun:test";

import type { SettingsResolution } from "@/lib/config/effective";
import { isDisabledBySettings, mechanismFor, whyDisabled } from "./mechanism";

/** A resolution holding one key, as if it had been read from the given scope's file. */
function resolution(
  key: string,
  value: unknown,
  scope: "user" | "managed" = "user"
): SettingsResolution {
  return {
    effectiveValues: [
      {
        key,
        effectiveValue: value,
        winningScope: scope,
        perScope: { [scope]: value },
      },
    ],
    fileStatuses: [],
    parsed: {},
  };
}

describe("the mechanism Claude Code disables each item type with", () => {
  test("a user-scope MCP server is denied by name", () => {
    const mechanism = mechanismFor("mcp", "user");
    expect(mechanism.key).toBe("deniedMcpServers");
    expect(mechanism.disable(undefined, "playwright")).toEqual([
      { serverName: "playwright" },
    ]);
    expect(
      mechanism.disables([{ serverName: "playwright" }], "playwright")
    ).toBe(true);
  });

  test("a project's .mcp.json server is disabled by the key Claude Code has for that", () => {
    const mechanism = mechanismFor("mcp", "project");
    expect(mechanism.key).toBe("disabledMcpjsonServers");
    expect(mechanism.disable(["a"], "b")).toEqual(["a", "b"]);
  });

  test("a skill is turned off in skillOverrides", () => {
    const mechanism = mechanismFor("skill", "user");
    expect(mechanism.disable({ other: "off" }, "caveman")).toEqual({
      other: "off",
      caveman: "off",
    });
    expect(mechanism.disables({ caveman: "off" }, "caveman")).toBe(true);
  });

  test('only "off" disables a skill; the narrowing states do not', () => {
    const mechanism = mechanismFor("skill", "user");
    expect(mechanism.disables({ caveman: "off" }, "caveman")).toBe(true);
    expect(mechanism.disables({ caveman: "name-only" }, "caveman")).toBe(false);
    expect(
      mechanism.disables({ caveman: "user-invocable-only" }, "caveman")
    ).toBe(false);
    expect(mechanism.disables({ caveman: "hidden" }, "caveman")).toBe(false);
  });

  test("a plugin is set false in enabledPlugins", () => {
    const mechanism = mechanismFor("plugin", "user");
    expect(mechanism.disable(undefined, "diagrams@second-brain")).toEqual({
      "diagrams@second-brain": false,
    });
  });

  test("enabling removes the entry, and a key left empty is unset entirely", () => {
    expect(
      mechanismFor("mcp", "user").enable(
        [{ serverName: "playwright" }],
        "playwright"
      )
    ).toBeUndefined();
    expect(
      mechanismFor("skill", "user").enable({ caveman: "off" }, "caveman")
    ).toBeUndefined();
    expect(
      mechanismFor("skill", "user").enable(
        { caveman: "off", other: "off" },
        "caveman"
      )
    ).toEqual({
      other: "off",
    });
  });

  test("disabling something already disabled changes nothing", () => {
    const denied = [{ serverName: "playwright" }];
    expect(mechanismFor("mcp", "user").disable(denied, "playwright")).toBe(
      denied
    );
  });
});

describe("whyDisabled", () => {
  test("names the scope whose settings decided it", () => {
    const managed = resolution("skillOverrides", { caveman: "off" }, "managed");
    expect(whyDisabled("skill", "caveman", "user", managed)).toBe("managed");
    expect(isDisabledBySettings("skill", "caveman", "user", managed)).toBe(
      true
    );
  });

  test("says nothing about an item nothing disables", () => {
    expect(
      whyDisabled(
        "skill",
        "other",
        "user",
        resolution("skillOverrides", { caveman: "off" })
      )
    ).toBeUndefined();
  });
});
