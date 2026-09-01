import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  captureFileSnapshot,
  decodeExpectedFile,
  type ExpectedFile,
} from "@/lib/config/mutate";
import {
  readScopeSettings,
  resolveEffectiveSettings,
  settingFilePath,
  type SettingsLocation,
} from "@/lib/config/settings";
import { setItemState } from "./set-state";
import { archivedItemsPath, isArchived } from "./item-state";
import { itemState } from "./state";

async function makeLocation(userSettings = "{}"): Promise<SettingsLocation> {
  const root = await mkdtemp(join(tmpdir(), "boopervisor-item-"));
  const location = {
    homeDir: join(root, "home"),
    projectRoot: join(root, "project"),
  };
  const path = settingFilePath("user", location);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, userSettings);
  return location;
}

/** The current, valid tokens for both files a state change touches. */
async function tokens(
  scope: "user" | "project",
  location: SettingsLocation
): Promise<{ expectedSettings: ExpectedFile; expectedArchive: ExpectedFile }> {
  return {
    expectedSettings: await captureFileSnapshot(
      settingFilePath(scope, location)
    ),
    expectedArchive: await captureFileSnapshot(
      archivedItemsPath(location.homeDir)
    ),
  };
}

describe("setItemState", () => {
  test("disabling a skill writes Claude Code's own key for skills", async () => {
    const location = await makeLocation();
    const result = await setItemState({
      type: "skill",
      name: "caveman",
      state: "disabled",
      scope: "user",
      location,
      ...(await tokens("user", location)),
    });

    expect(result.error).toBeUndefined();
    expect(await readScopeSettings("user", location)).toEqual({
      skillOverrides: { caveman: "off" },
    });
  });

  test("enabling it again removes the key rather than leaving an empty one", async () => {
    const location = await makeLocation(
      '{"skillOverrides":{"caveman":"off"},"model":"opus"}'
    );
    await setItemState({
      type: "skill",
      name: "caveman",
      state: "enabled",
      scope: "user",
      location,
      ...(await tokens("user", location)),
    });

    expect(await readScopeSettings("user", location)).toEqual({
      model: "opus",
    });
  });

  test("disabling an MCP server names it the way deniedMcpServers does", async () => {
    const location = await makeLocation();
    await setItemState({
      type: "mcp",
      name: "playwright",
      state: "disabled",
      scope: "user",
      location,
      ...(await tokens("user", location)),
    });

    expect(await readScopeSettings("user", location)).toEqual({
      deniedMcpServers: [{ serverName: "playwright" }],
    });
  });

  test("disabling a local-scope MCP server writes deniedMcpServers too", async () => {
    const location = await makeLocation();
    await setItemState({
      type: "mcp",
      name: "test-local",
      state: "disabled",
      scope: "project",
      location,
      source: "local",
      ...(await tokens("project", location)),
    });

    expect(await readScopeSettings("project", location)).toEqual({
      deniedMcpServers: [{ serverName: "test-local" }],
    });
  });

  test("disabling a project .mcp.json server still uses disabledMcpjsonServers", async () => {
    const location = await makeLocation();
    await setItemState({
      type: "mcp",
      name: "project-server",
      state: "disabled",
      scope: "project",
      location,
      source: "project",
      ...(await tokens("project", location)),
    });

    expect(await readScopeSettings("project", location)).toEqual({
      disabledMcpjsonServers: ["project-server"],
    });
  });

  test("archiving a local server keys the archive by its source, not just its name", async () => {
    const location = await makeLocation();
    await setItemState({
      type: "mcp",
      name: "shared-name",
      state: "archived",
      scope: "project",
      location,
      source: "local",
      ...(await tokens("project", location)),
    });
    await setItemState({
      type: "mcp",
      name: "shared-name",
      state: "archived",
      scope: "project",
      location,
      source: "project",
      ...(await tokens("project", location)),
    });

    expect(
      await isArchived(
        "mcp",
        "project",
        "local:shared-name",
        location.projectRoot,
        location.homeDir
      )
    ).toBe(true);
    expect(
      await isArchived(
        "mcp",
        "project",
        "shared-name",
        location.projectRoot,
        location.homeDir
      )
    ).toBe(true);
  });

  test("itemState reports an archived local server as archived, not by its plain name", async () => {
    const location = await makeLocation();
    await setItemState({
      type: "mcp",
      name: "test-local",
      state: "archived",
      scope: "project",
      location,
      source: "local",
      ...(await tokens("project", location)),
    });

    const resolution = await resolveEffectiveSettings(location);
    expect(
      await itemState(
        "mcp",
        "test-local",
        "project",
        resolution,
        location.projectRoot,
        "local",
        location.homeDir
      )
    ).toBe("archived");
  });

  test("archiving a project .mcp.json server does not archive a same-named local server", async () => {
    const location = await makeLocation();
    await setItemState({
      type: "mcp",
      name: "shared-name",
      state: "archived",
      scope: "project",
      location,
      source: "project",
      ...(await tokens("project", location)),
    });

    const resolution = await resolveEffectiveSettings(location);
    expect(
      await itemState(
        "mcp",
        "shared-name",
        "project",
        resolution,
        location.projectRoot,
        "local",
        location.homeDir
      )
    ).toBe("enabled");
    expect(
      await itemState(
        "mcp",
        "shared-name",
        "project",
        resolution,
        location.projectRoot,
        "project",
        location.homeDir
      )
    ).toBe("archived");
  });

  test("a state an item is already in writes nothing at all", async () => {
    const location = await makeLocation('{"model":"opus"}');
    const path = settingFilePath("user", location);
    await setItemState({
      type: "skill",
      name: "caveman",
      state: "enabled",
      scope: "user",
      location,
      ...(await tokens("user", location)),
    });

    expect(await readFile(path, "utf8")).toBe('{"model":"opus"}');
  });

  test("archiving holds the item disabled as well", async () => {
    const location = await makeLocation();
    await setItemState({
      type: "plugin",
      name: "a@b",
      state: "archived",
      scope: "user",
      location,
      ...(await tokens("user", location)),
    });

    expect(await readScopeSettings("user", location)).toEqual({
      enabledPlugins: { "a@b": false },
    });
    expect(
      await isArchived(
        "plugin",
        "user",
        "a@b",
        location.projectRoot,
        location.homeDir
      )
    ).toBe(true);

    await setItemState({
      type: "plugin",
      name: "a@b",
      state: "enabled",
      scope: "user",
      location,
      ...(await tokens("user", location)),
    });
    expect(
      await isArchived(
        "plugin",
        "user",
        "a@b",
        location.projectRoot,
        location.homeDir
      )
    ).toBe(false);
  });

  test("archival is recorded under the location's home", async () => {
    const location = await makeLocation();
    await setItemState({
      type: "plugin",
      name: "a@b",
      state: "archived",
      scope: "user",
      location,
      ...(await tokens("user", location)),
    });

    const path = join(location.homeDir!, ".claude", "boopervisor.json");
    const parsed = JSON.parse(await readFile(path, "utf8"));
    expect(Object.keys(parsed.archivedItems)).toHaveLength(1);
  });

  test("a state change succeeds when both tokens match the files", async () => {
    const location = await makeLocation();
    const result = await setItemState({
      type: "skill",
      name: "caveman",
      state: "disabled",
      scope: "user",
      location,
      ...(await tokens("user", location)),
    });

    expect(result.error).toBeUndefined();
  });

  test("a state change is refused when the settings file changed after the token was taken", async () => {
    const location = await makeLocation();
    const settingsPath = settingFilePath("user", location);
    const captured = await tokens("user", location);
    await writeFile(settingsPath, '{"changedBySomeoneElse":true}');

    const result = await setItemState({
      type: "skill",
      name: "caveman",
      state: "disabled",
      scope: "user",
      location,
      ...captured,
    });

    expect(result.error).toContain(settingsPath);
  });

  test("a state change is refused when ~/.claude/boopervisor.json changed after its token was taken", async () => {
    const location = await makeLocation();
    const archivePath = archivedItemsPath(location.homeDir);
    const captured = await tokens("user", location);
    await mkdir(join(archivePath, ".."), { recursive: true });
    await writeFile(
      archivePath,
      '{"archivedItems":{"changedBySomeoneElse":{}}}'
    );

    const result = await setItemState({
      type: "skill",
      name: "caveman",
      state: "disabled",
      scope: "user",
      location,
      ...captured,
    });

    expect(result.error).toContain(archivePath);
  });

  test("a stale archive token leaves the settings file untouched, even when it was disabled first", async () => {
    const location = await makeLocation();
    const settingsPath = settingFilePath("user", location);
    const archivePath = archivedItemsPath(location.homeDir);
    const captured = await tokens("user", location);
    await mkdir(join(archivePath, ".."), { recursive: true });
    await writeFile(
      archivePath,
      '{"archivedItems":{"changedBySomeoneElse":{}}}'
    );
    const settingsBefore = await readFile(settingsPath, "utf8");

    const result = await setItemState({
      type: "skill",
      name: "caveman",
      state: "archived",
      scope: "user",
      location,
      ...captured,
    });

    expect(result.error).toContain(archivePath);
    expect(await readFile(settingsPath, "utf8")).toBe(settingsBefore);
  });

  test("an empty or malformed token is refused", async () => {
    const location = await makeLocation();
    const result = await setItemState({
      type: "skill",
      name: "caveman",
      state: "disabled",
      scope: "user",
      location,
      expectedSettings: decodeExpectedFile(undefined),
      expectedArchive: decodeExpectedFile(undefined),
    });

    expect(result.error).toBeTruthy();
  });
});

describe("isArchived", () => {
  test("an item nothing has archived is not archived", async () => {
    const home = await mkdtemp(join(tmpdir(), "boopervisor-archive-"));
    expect(await isArchived("skill", "user", "caveman", undefined, home)).toBe(
      false
    );
  });
});
