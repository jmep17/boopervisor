import { describe, expect, test } from "bun:test";

import { getSetting } from "@/lib/catalog";
import { USER_SCOPE, type ScopeSelection } from "@/lib/scope/scope";
import { readWriteSettingForm } from "./write-setting";

const PROJECT_SCOPE: ScopeSelection = {
  kind: "project",
  path: "/home/me/project",
};

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

describe("readWriteSettingForm", () => {
  test("refuses a missing key", () => {
    const result = readWriteSettingForm(form({ scope: "user" }), USER_SCOPE);
    expect(result).toEqual({ ok: false, error: "No setting named." });
  });

  test("refuses a blank key", () => {
    const result = readWriteSettingForm(
      form({ key: "   ", scope: "user" }),
      USER_SCOPE
    );
    expect(result).toEqual({ ok: false, error: "No setting named." });
  });

  test("refuses a scope that is not user, project or local", () => {
    for (const scope of ["managed", "junk", ""]) {
      const result = readWriteSettingForm(
        form({ key: "model", scope }),
        USER_SCOPE
      );
      expect(result).toEqual({
        ok: false,
        error: "That scope cannot be written.",
      });
    }
  });

  test("refuses a project scope when no project is selected", () => {
    const result = readWriteSettingForm(
      form({ key: "model", scope: "project" }),
      USER_SCOPE
    );
    expect(result).toEqual({
      ok: false,
      error: "Select a project before editing its settings.",
    });
  });

  test("refuses a local scope when no project is selected", () => {
    const result = readWriteSettingForm(
      form({ key: "model", scope: "local" }),
      USER_SCOPE
    );
    expect(result).toEqual({
      ok: false,
      error: "Select a project before editing its settings.",
    });
  });

  test("builds location.projectRoot from a project selection", () => {
    const result = readWriteSettingForm(
      form({ key: "model", scope: "project", value: "opus" }),
      PROJECT_SCOPE
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.location).toEqual({ projectRoot: "/home/me/project" });
  });

  test("leaves location.projectRoot undefined for the user scope", () => {
    const result = readWriteSettingForm(
      form({ key: "model", scope: "user", value: "opus" }),
      USER_SCOPE
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.location).toEqual({ projectRoot: undefined });
  });

  test("unset present yields value: undefined whatever the value field says", () => {
    const result = readWriteSettingForm(
      form({ key: "model", scope: "user", value: "opus", unset: "on" }),
      USER_SCOPE
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeUndefined();
  });

  test("a bad value for a catalogued key is refused with the parser's message", () => {
    expect(getSetting("cleanupPeriodDays")).toBeDefined();
    const result = readWriteSettingForm(
      form({ key: "cleanupPeriodDays", scope: "user", value: "not-a-number" }),
      USER_SCOPE
    );
    expect(result).toEqual({
      ok: false,
      error: "not-a-number is not a number.",
    });
  });

  test("accepts a good value for a catalogued key", () => {
    expect(getSetting("model")).toBeDefined();
    const result = readWriteSettingForm(
      form({ key: "model", scope: "user", value: "opus" }),
      USER_SCOPE
    );
    expect(result).toEqual({
      ok: true,
      scope: "user",
      location: { projectRoot: undefined },
      key: "model",
      value: "opus",
      expected: { hash: "", mtimeMs: -1 },
    });
  });

  test("an uncatalogued key parses its value as JSON", () => {
    const result = readWriteSettingForm(
      form({ key: "someUncataloguedKey", scope: "user", value: '{"a":1}' }),
      USER_SCOPE
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ a: 1 });
  });

  test("an uncatalogued key with invalid JSON is refused", () => {
    const result = readWriteSettingForm(
      form({ key: "someUncataloguedKey", scope: "user", value: "not json" }),
      USER_SCOPE
    );
    expect(result.ok).toBe(false);
  });
});
