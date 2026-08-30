import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  readScopeSettings,
  settingFilePath,
  type SettingsLocation,
} from "@/lib/config/settings";
import { setItemState } from "./set-state";
import { isArchived } from "./item-state";

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

describe("setItemState", () => {
  test("disabling a skill writes Claude Code's own key for skills", async () => {
    const location = await makeLocation();
    const result = await setItemState({
      type: "skill",
      name: "caveman",
      state: "disabled",
      scope: "user",
      location,
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
    });

    expect(await readScopeSettings("user", location)).toEqual({
      deniedMcpServers: [{ serverName: "playwright" }],
    });
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
    });

    const path = join(location.homeDir!, ".claude", "boopervisor.json");
    const parsed = JSON.parse(await readFile(path, "utf8"));
    expect(Object.keys(parsed.archivedItems)).toHaveLength(1);
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
