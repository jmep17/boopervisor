import { describe, expect, test } from "bun:test";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  BACKUP_LIMIT,
  backupDirectory,
  captureFileSnapshot,
  decodeExpectedFile,
  encodeExpectedFile,
  mutateJsonFile,
  type MutationResult,
} from "./mutate";
import { readMutationLog } from "./mutations";

const TARGET = { kind: "setting", scope: "user", key: "model" } as const;

async function makeHome(
  contents?: string
): Promise<{ homeDir: string; path: string }> {
  const homeDir = await mkdtemp(join(tmpdir(), "boopervisor-mutate-"));
  const path = join(homeDir, ".claude", "settings.json");
  if (contents !== undefined) {
    await mkdir(join(homeDir, ".claude"), { recursive: true });
    await writeFile(path, contents);
  }
  return { homeDir, path };
}

async function write(
  path: string,
  homeDir: string,
  apply: (content: Record<string, unknown>) => Record<string, unknown>,
  expected?: { hash: string; mtimeMs: number }
): Promise<MutationResult> {
  return mutateJsonFile({
    path,
    expected: expected ?? (await captureFileSnapshot(path)),
    target: TARGET,
    apply,
    homeDir,
  });
}

describe("captureFileSnapshot", () => {
  test("an absent file snapshots as absent rather than failing", async () => {
    const { path } = await makeHome();
    const snapshot = await captureFileSnapshot(path);

    expect(snapshot.exists).toBe(false);
    expect(snapshot.content).toEqual({});
    expect(snapshot.state).toBe("missing");
  });

  test("hashes the file's bytes, so a change to whitespace alone is still a change", async () => {
    const { path, homeDir } = await makeHome('{"model":"opus"}');
    const before = await captureFileSnapshot(path);
    await writeFile(path, '{\n  "model": "opus"\n}');
    const after = await captureFileSnapshot(path);

    expect(after.hash).not.toBe(before.hash);
    expect(homeDir).toBeTruthy();
  });
});

describe("mutateJsonFile", () => {
  test("writes the change and leaves every other key untouched", async () => {
    const { path, homeDir } = await makeHome(
      '{"model":"opus","somethingUnknown":{"a":[1,2]}}'
    );
    const result = await write(path, homeDir, (content) => ({
      ...content,
      model: "sonnet",
    }));

    expect(result.ok).toBe(true);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({
      model: "sonnet",
      somethingUnknown: { a: [1, 2] },
    });
  });

  test("keeps the file's own indentation rather than reformatting it", async () => {
    const { path, homeDir } = await makeHome('{\n    "model": "opus"\n}\n');
    await write(path, homeDir, (content) => ({ ...content, verbose: true }));

    expect(await readFile(path, "utf8")).toBe(
      '{\n    "model": "opus",\n    "verbose": true\n}\n'
    );
  });

  test("creates a file that does not exist yet", async () => {
    const { path, homeDir } = await makeHome();
    const result = await write(path, homeDir, () => ({ model: "opus" }));

    expect(result.ok).toBe(true);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ model: "opus" });
  });

  test("refuses a file whose contents changed since it was read", async () => {
    const { path, homeDir } = await makeHome('{"model":"opus"}');
    const expected = await captureFileSnapshot(path);
    await writeFile(path, '{"model":"changed by someone else"}');

    const result = await write(
      path,
      homeDir,
      (content) => ({ ...content, verbose: true }),
      expected
    );

    expect(result).toMatchObject({ ok: false, problem: "stale" });
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({
      model: "changed by someone else",
    });
  });

  test("refuses a file whose mtime changed even when its contents did not", async () => {
    const { path, homeDir } = await makeHome('{"model":"opus"}');
    const expected = await captureFileSnapshot(path);
    const later = new Date(Date.now() + 10_000);
    await utimes(path, later, later);

    expect(await write(path, homeDir, (c) => c, expected)).toMatchObject({
      ok: false,
      problem: "stale",
    });
  });

  test("refuses a file that appeared after it was read as absent", async () => {
    const { path, homeDir } = await makeHome();
    const expected = await captureFileSnapshot(path);
    await mkdir(join(homeDir, ".claude"), { recursive: true });
    await writeFile(path, '{"model":"written by someone else"}');

    expect(
      await write(path, homeDir, () => ({ model: "opus" }), expected)
    ).toMatchObject({
      ok: false,
      problem: "stale",
    });
  });

  test("refuses to overwrite a file it cannot parse", async () => {
    const { path, homeDir } = await makeHome("{ not json");

    expect(await write(path, homeDir, () => ({ model: "opus" }))).toMatchObject(
      {
        ok: false,
        problem: "invalid",
      }
    );
    expect(await readFile(path, "utf8")).toBe("{ not json");
  });

  test("refuses a value validation rejects, before anything is written", async () => {
    const { path, homeDir } = await makeHome('{"model":"opus"}');
    const result = await mutateJsonFile({
      path,
      expected: await captureFileSnapshot(path),
      target: TARGET,
      apply: (content) => ({ ...content, model: 3 }),
      validate: () => ({ ok: false, problem: "model must be a string." }),
      homeDir,
    });

    expect(result).toMatchObject({
      ok: false,
      problem: "invalid",
      message: "model must be a string.",
    });
    expect(await readFile(path, "utf8")).toBe('{"model":"opus"}');
    await expect(stat(backupDirectory(homeDir))).rejects.toThrow();
  });

  test("backs the file up as <file>.<timestamp>.json before touching it", async () => {
    const { path, homeDir } = await makeHome('{"model":"opus"}');
    const result = await write(path, homeDir, (content) => ({
      ...content,
      model: "sonnet",
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backupPath).toMatch(/settings\.json\.\d+\.json$/);
    expect(await readFile(result.backupPath, "utf8")).toBe('{"model":"opus"}');
  });

  test("keeps only the most recent backups of a file", async () => {
    const { path, homeDir } = await makeHome("{}");
    for (let index = 0; index < BACKUP_LIMIT + 5; index += 1) {
      await write(path, homeDir, (content) => ({
        ...content,
        [`key${index}`]: index,
      }));
    }

    const backups = await readdir(backupDirectory(homeDir));
    expect(backups.length).toBe(BACKUP_LIMIT);
  });

  test("records the mutation with enough to render a diff and to restore", async () => {
    const { path, homeDir } = await makeHome('{"model":"opus"}');
    await write(path, homeDir, (content) => ({ ...content, model: "sonnet" }));

    const [record] = await readMutationLog(homeDir);
    expect(record.target).toEqual(TARGET);
    expect(record.path).toBe(path);
    expect(record.before).toBe('{"model":"opus"}');
    expect(JSON.parse(record.after)).toEqual({ model: "sonnet" });
    expect(await readFile(record.backupPath, "utf8")).toBe(record.before);
  });
});

describe("the expected-file token", () => {
  test("survives a round trip through a form value", async () => {
    const { path } = await makeHome('{"model":"opus"}');
    const snapshot = await captureFileSnapshot(path);
    const decoded = decodeExpectedFile(encodeExpectedFile(snapshot));

    expect(decoded).toEqual({ hash: snapshot.hash, mtimeMs: snapshot.mtimeMs });
  });

  test("anything unreadable fails the stale check rather than skipping it", () => {
    expect(decodeExpectedFile(undefined)).toEqual({ hash: "", mtimeMs: -1 });
    expect(decodeExpectedFile("nonsense")).toEqual({ hash: "", mtimeMs: -1 });
  });
});
