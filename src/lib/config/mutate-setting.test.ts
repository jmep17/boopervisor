import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { mutateSetting, snapshotScope } from "./mutate-setting";
import { backupDirectory } from "./mutate";
import { settingFilePath, type SettingsLocation } from "./settings";
import { readMutationLog } from "./mutations";

async function makeLocation(userSettings?: string): Promise<SettingsLocation> {
  const root = await mkdtemp(join(tmpdir(), "boopervisor-write-"));
  const location = {
    homeDir: join(root, "home"),
    projectRoot: join(root, "project"),
  };
  if (userSettings !== undefined) {
    const path = settingFilePath("user", location);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, userSettings);
  }
  return location;
}

describe("mutateSetting", () => {
  test("writes one key to the named scope's file", async () => {
    const location = await makeLocation('{"verbose":false}');
    const result = await mutateSetting({
      scope: "user",
      location,
      key: "verbose",
      value: true,
      expected: await snapshotScope("user", location),
    });

    expect(result.ok).toBe(true);
    expect(
      JSON.parse(await readFile(settingFilePath("user", location), "utf8"))
    ).toEqual({
      verbose: true,
    });
  });

  test("refuses a value the catalog rejects, before anything is written", async () => {
    const location = await makeLocation('{"verbose":false}');
    const result = await mutateSetting({
      scope: "user",
      location,
      key: "verbose",
      value: "yes please",
      expected: await snapshotScope("user", location),
    });

    expect(result).toMatchObject({ ok: false, problem: "invalid" });
    expect(await readFile(settingFilePath("user", location), "utf8")).toBe(
      '{"verbose":false}'
    );
    expect(await readMutationLog(location.homeDir)).toEqual([]);
  });

  test("an undefined value unsets the key, leaving the others alone", async () => {
    const location = await makeLocation('{"verbose":true,"model":"opus"}');
    await mutateSetting({
      scope: "user",
      location,
      key: "verbose",
      value: undefined,
      expected: await snapshotScope("user", location),
    });

    expect(
      JSON.parse(await readFile(settingFilePath("user", location), "utf8"))
    ).toEqual({
      model: "opus",
    });
  });

  test("refuses to write managed settings at all", async () => {
    const location = await makeLocation("{}");
    const result = await mutateSetting({
      scope: "managed",
      location,
      key: "verbose",
      value: true,
      expected: await snapshotScope("user", location),
    });

    expect(result).toMatchObject({
      ok: false,
      message: "Managed settings are read-only.",
    });
  });

  test("records the backup and the mutation under the location's home", async () => {
    const location = await makeLocation('{"verbose":false}');
    const result = await mutateSetting({
      scope: "user",
      location,
      key: "verbose",
      value: true,
      expected: await snapshotScope("user", location),
    });

    expect(result.ok).toBe(true);
    const log = await readMutationLog(location.homeDir);
    expect(log.length).toBe(1);
    expect(log[0].target).toMatchObject({ key: "verbose" });
    expect((await readdir(backupDirectory(location.homeDir))).length).toBe(1);
  });
});

describe("nested keys", () => {
  test("writes a key into the container the catalog names, not as a flat key", async () => {
    const location = await makeLocation('{"model":"opus"}');
    const result = await mutateSetting({
      scope: "user",
      location,
      key: "permissions.allow",
      value: ["Bash(ls:*)"],
      expected: await snapshotScope("user", location),
    });

    expect(result.ok).toBe(true);
    expect(
      JSON.parse(await readFile(settingFilePath("user", location), "utf8"))
    ).toEqual({
      model: "opus",
      permissions: { allow: ["Bash(ls:*)"] },
    });
  });

  test("unsetting the last key in a container takes the container with it", async () => {
    const location = await makeLocation(
      '{"permissions":{"allow":["Bash"]},"model":"opus"}'
    );
    await mutateSetting({
      scope: "user",
      location,
      key: "permissions.allow",
      value: undefined,
      expected: await snapshotScope("user", location),
    });

    expect(
      JSON.parse(await readFile(settingFilePath("user", location), "utf8"))
    ).toEqual({
      model: "opus",
    });
  });
});
