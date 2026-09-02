import { describe, expect, test } from "bun:test";
import { parseValueForSetting } from "@/lib/config/value-form";
import { validateSetting } from "@/lib/config/validate";
import {
  ALL_SETTINGS,
  HOOK_EVENTS,
  getHookEvent,
  isUnknownHookEvent,
  SETTINGS,
  getSetting,
  isUncatalogued,
  orphanedOverrides,
  settingsForScope,
  settingsByTopic,
  OVERRIDES,
  ENV_VARS,
  getEnvVar,
  isUnknownEnvVar,
} from "./index";

describe("catalog", () => {
  test("every override names a documented key", () => {
    expect(orphanedOverrides()).toEqual([]);
  });

  test("every override explains itself", () => {
    const unexplained = Object.entries(OVERRIDES)
      .filter(([, o]) => !o.note?.trim())
      .map(([key]) => key);
    expect(unexplained).toEqual([]);
  });

  test("every key has at least one scope", () => {
    expect(ALL_SETTINGS.filter((s) => s.scopes.length === 0)).toEqual([]);
  });

  test("keys are unique", () => {
    expect(new Set(ALL_SETTINGS.map((s) => s.key)).size).toBe(
      ALL_SETTINGS.length
    );
  });

  test("no settable key is left with an unresolved value type", () => {
    // `strictPluginOnlyCustomization` is a documented union of Boolean and array, so it has
    // no single value type. Virtual keys describe another key's value and are not settable.
    const unresolved = SETTINGS.filter((s) => s.valueType === "unknown").map(
      (s) => s.key
    );
    expect(unresolved).toEqual(["strictPluginOnlyCustomization"]);
  });

  test("a select always has values to select from", () => {
    const empty = SETTINGS.filter(
      (s) => s.control === "select" && s.enumValues.length < 2
    );
    expect(empty).toEqual([]);
  });

  test("a literal toggle knows what string it writes", () => {
    const missing = SETTINGS.filter(
      (s) => s.control === "literalToggle" && !s.literal
    );
    expect(missing).toEqual([]);
  });

  test("virtual keys are hidden from the interface but still resolvable", () => {
    expect(SETTINGS.some((s) => s.key === "permissions")).toBe(false);
    expect(getSetting("permissions")?.virtual).toBe(true);
  });

  test("known enumerated keys carry their documented values", () => {
    expect(getSetting("effortLevel")?.enumValues).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    expect(getSetting("permissions.defaultMode")?.enumValues).toContain("plan");
    expect(getSetting("autoUpdatesChannel")?.control).toBe("select");
  });

  test("example values in prose are not treated as a closed set", () => {
    expect(getSetting("language")?.control).toBe("combobox");
    expect(getSetting("language")?.enumValues).toEqual([]);
    expect(getSetting("model")?.control).toBe("combobox");
  });

  test("array keys whose entries are models offer the model list", () => {
    for (const key of ["fallbackModel", "availableModels"]) {
      expect(getSetting(key)?.control).toBe("stringList");
      expect(getSetting(key)?.optionSource).toBe("models");
    }
  });

  test("theme accepts its custom forms", () => {
    const theme = getSetting("theme")!;
    expect(theme.enumValues).toEqual([]);
    expect(theme.suggestions).toHaveLength(7);
    expect(validateSetting("custom:mine", theme).ok).toBe(true);
  });

  test("agent is a name, not an object", () => {
    const agent = getSetting("agent");
    expect(agent?.control).toBe("combobox");
    expect(agent?.optionSource).toBe("agents");
    expect(agent?.valueType).toBe("string");
  });

  test("an option source has a fallback when the machine has nothing", () => {
    const missing = SETTINGS.filter(
      (setting) =>
        setting.optionSource &&
        setting.suggestions.length === 0 &&
        setting.optionSource !== "agents"
    );
    expect(missing).toEqual([]);
  });

  test("fallbackModel parses as a list", () => {
    expect(
      parseValueForSetting('["opus"]', getSetting("fallbackModel")).ok
    ).toBe(true);
  });

  test("managed-only keys do not appear in user scope", () => {
    const userKeys = settingsForScope("user").map((s) => s.key);
    expect(userKeys).not.toContain("allowManagedHooksOnly");
    expect(settingsForScope("managed").map((s) => s.key)).toContain(
      "allowManagedHooksOnly"
    );
  });

  test("an unrecognised key is reported as uncatalogued", () => {
    expect(isUncatalogued("model")).toBe(false);
    expect(isUncatalogued("notARealSetting")).toBe(true);
  });

  test("topics cover every settable key", () => {
    const grouped = settingsByTopic().flatMap((t) => t.settings);
    expect(grouped.length).toBe(SETTINGS.length);
  });

  test("hook events are extracted, unique, and described", () => {
    expect(HOOK_EVENTS.length).toBeGreaterThan(25);
    expect(new Set(HOOK_EVENTS.map((e) => e.event)).size).toBe(
      HOOK_EVENTS.length
    );
    expect(HOOK_EVENTS.filter((e) => !e.summary)).toEqual([]);
  });

  test("the events hooks are most often written against are present", () => {
    for (const event of [
      "PreToolUse",
      "PostToolUse",
      "SessionStart",
      "Stop",
      "UserPromptSubmit",
    ]) {
      expect(getHookEvent(event)?.event).toBe(event);
    }
    expect(isUnknownHookEvent("NotAnEvent")).toBe(true);
  });

  test("environment variables are extracted, unique, and described", () => {
    expect(ENV_VARS.length).toBeGreaterThan(300);
    expect(new Set(ENV_VARS.map((v) => v.name)).size).toBe(ENV_VARS.length);
    expect(ENV_VARS.filter((v) => !v.purpose)).toEqual([]);
    expect(ENV_VARS.every((v) => v.docUrl.endsWith("#variables"))).toBe(true);
  });

  test("the variables the settings reference names are present", () => {
    for (const name of [
      "ANTHROPIC_API_KEY",
      "ANTHROPIC_MODEL",
      "CLAUDE_CODE_EFFORT_LEVEL",
      "API_TIMEOUT_MS",
      "DISABLE_TELEMETRY",
    ]) {
      expect(getEnvVar(name)?.name).toBe(name);
    }
    expect(getEnvVar("DISABLE_TELEMETRY")?.presenceOnly).toBe(true);
    expect(isUnknownEnvVar("NOT_A_VARIABLE")).toBe(true);
  });
});
