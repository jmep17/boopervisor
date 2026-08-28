import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  isOverridden,
  managedSettingsPath,
  readSettingsFile,
  resolveEffectiveSettings,
  resolveKey,
  scopesFor,
  settingFilePath,
  type SettingsLocation,
} from "./settings";

/** A temporary home and project holding whichever settings files a test names. */
async function makeLocation(
  files: Partial<Record<"user" | "project" | "local" | "managed", string>>
): Promise<SettingsLocation> {
  const root = await mkdtemp(join(tmpdir(), "boopervisor-settings-"));
  const homeDir = join(root, "home");
  const projectRoot = join(root, "project");
  const managedPath = join(root, "managed-settings.json");
  const location = { homeDir, projectRoot, managedPath };

  for (const [scope, text] of Object.entries(files)) {
    const path = settingFilePath(scope as "user", location);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, text);
  }
  return location;
}

describe("settingFilePath", () => {
  test("puts each scope's file where Claude Code reads it", () => {
    const location = { homeDir: "/home/x", projectRoot: "/work/app" };
    expect(settingFilePath("user", location)).toBe(
      "/home/x/.claude/settings.json"
    );
    expect(settingFilePath("project", location)).toBe(
      "/work/app/.claude/settings.json"
    );
    expect(settingFilePath("local", location)).toBe(
      "/work/app/.claude/settings.local.json"
    );
  });

  test("puts managed settings outside the home directory and the project", () => {
    expect(managedSettingsPath("darwin")).toBe(
      "/Library/Application Support/ClaudeCode/managed-settings.json"
    );
    expect(managedSettingsPath("linux")).toBe(
      "/etc/claude-code/managed-settings.json"
    );
  });

  test("refuses ~/.claude.json, which is not part of the settings merge", () => {
    expect(() => settingFilePath("globalConfig", {})).toThrow(
      /not a settings file/
    );
  });

  test("refuses a project scope with no project", () => {
    expect(() => settingFilePath("project", {})).toThrow(
      /needs a project directory/
    );
  });
});

describe("readSettingsFile", () => {
  test("reports missing, empty and malformed rather than throwing", async () => {
    const location = await makeLocation({
      user: "",
      project: "{ not json",
      local: "[]",
    });
    const read = async (scope: "user" | "project" | "local") =>
      readSettingsFile(settingFilePath(scope, location));

    expect(await read("user")).toEqual({ content: {}, state: "empty" });
    expect(await read("project")).toEqual({
      content: {},
      state: "invalid-json",
    });
    // A JSON array is valid JSON but not a settings file.
    expect(await read("local")).toEqual({ content: {}, state: "invalid-json" });
    expect(
      await readSettingsFile(join(location.homeDir!, "nope.json"))
    ).toEqual({
      content: {},
      state: "missing",
    });
  });
});

describe("resolveEffectiveSettings", () => {
  test("resolves managed over local over project over user", async () => {
    const location = await makeLocation({
      user: '{"model":"user","cleanupPeriodDays":7}',
      project: '{"model":"project"}',
      local: '{"model":"local"}',
      managed: '{"model":"managed"}',
    });
    const { effectiveValues } = await resolveEffectiveSettings(location);
    const model = effectiveValues.find((value) => value.key === "model")!;

    expect(model.effectiveValue).toBe("managed");
    expect(model.winningScope).toBe("managed");
    expect(model.perScope).toEqual({
      managed: "managed",
      local: "local",
      project: "project",
      user: "user",
    });
  });

  test("a lower scope wins a key the higher ones do not set", async () => {
    const location = await makeLocation({
      user: '{"model":"user","cleanupPeriodDays":7}',
      managed: '{"model":"managed"}',
    });
    const { effectiveValues } = await resolveEffectiveSettings(location);
    const days = effectiveValues.find(
      (value) => value.key === "cleanupPeriodDays"
    )!;

    expect(days.effectiveValue).toBe(7);
    expect(days.winningScope).toBe("user");
  });

  test("reads no project files when no project is selected", async () => {
    const location = await makeLocation({
      user: "{}",
      project: '{"model":"project"}',
    });
    const { fileStatuses, effectiveValues } = await resolveEffectiveSettings({
      homeDir: location.homeDir,
      managedPath: location.managedPath,
    });

    expect(fileStatuses.map((status) => status.scope)).toEqual([
      "managed",
      "user",
    ]);
    expect(effectiveValues).toEqual([]);
  });

  test("reports each file's state alongside its path", async () => {
    const location = await makeLocation({ user: "{ broken" });
    const { fileStatuses } = await resolveEffectiveSettings(location);
    const byScope = Object.fromEntries(
      fileStatuses.map((s) => [s.scope, s.state])
    );

    expect(byScope).toEqual({
      managed: "missing",
      local: "missing",
      project: "missing",
      user: "invalid-json",
    });
  });

  test("a malformed file contributes nothing but does not hide the others", async () => {
    const location = await makeLocation({
      user: '{"model":"user"}',
      project: "{ broken",
    });
    const { effectiveValues } = await resolveEffectiveSettings(location);

    expect(effectiveValues.map((value) => value.key)).toEqual(["model"]);
    expect(effectiveValues[0].winningScope).toBe("user");
  });
});

describe("resolveKey", () => {
  const scopes = scopesFor({ projectRoot: "/work/app" });

  test("a key set nowhere has no value and no contributing scope", () => {
    const effective = resolveKey("model", scopes, {});
    expect(effective.effectiveValue).toBeUndefined();
    expect(effective.perScope).toEqual({});
  });

  test("isOverridden is true only when a higher scope also sets the key", () => {
    const parsed = { user: { model: "a" }, managed: { model: "b" } };
    const effective = resolveKey("model", scopes, parsed);

    expect(isOverridden(effective, "user")).toBe(true);
    expect(isOverridden(effective, "managed")).toBe(false);
    expect(
      isOverridden(
        resolveKey("model", scopes, { user: { model: "a" } }),
        "user"
      )
    ).toBe(false);
  });
});

describe("nested keys", () => {
  test("resolves a key inside its container, per scope", async () => {
    const location = await makeLocation({
      user: '{"permissions":{"allow":["Bash"]}}',
      project: '{"permissions":{"allow":["Read"],"deny":["WebFetch"]}}',
    });
    const { effectiveValues } = await resolveEffectiveSettings(location);
    const allow = effectiveValues.find(
      (value) => value.key === "permissions.allow"
    )!;

    expect(allow.effectiveValue).toEqual(["Read"]);
    expect(allow.winningScope).toBe("project");
    expect(allow.perScope).toEqual({ project: ["Read"], user: ["Bash"] });
    expect(effectiveValues.map((value) => value.key)).toContain(
      "permissions.deny"
    );
  });
});
