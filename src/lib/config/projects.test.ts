import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkProjectDirectory,
  parseProjectPaths,
  readProjectPaths,
} from "./projects";

describe("parseProjectPaths", () => {
  test("returns the keys of the projects map", () => {
    expect(parseProjectPaths('{"projects":{"/a":{},"/b":{}}}')).toEqual([
      "/a",
      "/b",
    ]);
  });

  test("ignores everything else in the file", () => {
    const text =
      '{"numStartups":3,"projects":{"/a":{"history":[]}},"userID":"x"}';
    expect(parseProjectPaths(text)).toEqual(["/a"]);
  });

  test("returns nothing when the file is empty, malformed or unexpectedly shaped", () => {
    for (const text of [
      "",
      "   ",
      "{",
      "null",
      "[]",
      '{"projects":null}',
      '{"projects":[]}',
    ]) {
      expect(parseProjectPaths(text)).toEqual([]);
    }
  });
});

describe("readProjectPaths", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "boopervisor-projects-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("reads the projects map from disk", async () => {
    const file = join(dir, ".claude.json");
    await writeFile(file, '{"projects":{"/a":{},"/b":{}}}');
    expect(await readProjectPaths(file)).toEqual(["/a", "/b"]);
  });

  test("reports nothing when the file is absent", async () => {
    expect(await readProjectPaths(join(dir, "missing.json"))).toEqual([]);
  });

  test("reports nothing when the file is unparseable", async () => {
    const file = join(dir, ".claude.json");
    await writeFile(file, "{not json");
    expect(await readProjectPaths(file)).toEqual([]);
  });
});

describe("checkProjectDirectory", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "boopervisor-dir-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("accepts an existing directory", async () => {
    expect(await checkProjectDirectory(dir)).toBe("ok");
  });

  test("rejects a relative path without touching the disk", async () => {
    expect(await checkProjectDirectory("src")).toBe("not-absolute");
  });

  test("rejects a blank path", async () => {
    expect(await checkProjectDirectory("   ")).toBe("not-absolute");
  });

  test("rejects a path that does not exist", async () => {
    expect(await checkProjectDirectory(join(dir, "nope"))).toBe("missing");
  });

  test("rejects a file", async () => {
    const file = join(dir, "settings.json");
    await writeFile(file, "{}");
    expect(await checkProjectDirectory(file)).toBe("not-a-directory");
  });
});
