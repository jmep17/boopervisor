import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkProjectToAdd, withManualProject } from "./add-project";

describe("checkProjectToAdd", () => {
  test("refuses an empty path", async () => {
    const result = await checkProjectToAdd("");
    expect(result).toEqual({ ok: false, error: "Enter a directory path." });
  });

  test("refuses a whitespace-only path", async () => {
    const result = await checkProjectToAdd("   ");
    expect(result).toEqual({ ok: false, error: "Enter a directory path." });
  });

  test("refuses a relative path", async () => {
    const result = await checkProjectToAdd("relative/path");
    expect(result).toEqual({
      ok: false,
      error: "Enter an absolute path, starting with /.",
    });
  });

  test("refuses a path that does not exist", async () => {
    const result = await checkProjectToAdd("/no/such/directory/at/all");
    expect(result).toEqual({ ok: false, error: "No such directory." });
  });

  test("refuses a file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "boopervisor-add-project-"));
    const file = join(dir, "settings.json");
    await writeFile(file, "{}", "utf8");

    const result = await checkProjectToAdd(file);
    expect(result).toEqual({
      ok: false,
      error: "That path is a file, not a directory.",
    });
  });

  test("accepts a real temporary directory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "boopervisor-add-project-"));

    const result = await checkProjectToAdd(dir);
    expect(result).toEqual({ ok: true, path: dir });
  });

  test("accepts and trims a directory path with surrounding whitespace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "boopervisor-add-project-"));

    const result = await checkProjectToAdd(`  ${dir}  `);
    expect(result).toEqual({ ok: true, path: dir });
  });
});

describe("withManualProject", () => {
  test("appends a new path", () => {
    expect(withManualProject(["/a"], "/b")).toEqual(["/a", "/b"]);
  });

  test("returns an unchanged list for one already present", () => {
    expect(withManualProject(["/a", "/b"], "/b")).toEqual(["/a", "/b"]);
  });

  test("appends to an empty list", () => {
    expect(withManualProject([], "/a")).toEqual(["/a"]);
  });
});
