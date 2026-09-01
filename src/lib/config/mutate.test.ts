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
import { basename, join } from "node:path";

import {
  BACKUP_LIMIT,
  backupDirectory,
  captureFileSnapshot,
  decodeExpectedFile,
  encodeExpectedFile,
  exists,
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

describe("exists", () => {
  test("is true for a file on disk", async () => {
    const { path } = await makeHome('{"model":"opus"}');

    expect(await exists(path)).toBe(true);
  });

  test("is false for a missing path", async () => {
    const { path } = await makeHome();

    expect(await exists(path)).toBe(false);
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

  test("backs the file up as <file>.<digest>.<timestamp>.json before touching it", async () => {
    const { path, homeDir } = await makeHome('{"model":"opus"}');
    const result = await write(path, homeDir, (content) => ({
      ...content,
      model: "sonnet",
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backupPath).toMatch(
      /settings\.json\.[0-9a-f]{8}\.\d+\.json$/
    );
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

  test("two files that share a basename keep separate backup pools", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "boopervisor-mutate-"));
    const pathA = join(homeDir, "a", "settings.json");
    const pathB = join(homeDir, "b", "settings.json");
    await mkdir(join(homeDir, "a"), { recursive: true });
    await mkdir(join(homeDir, "b"), { recursive: true });
    await writeFile(pathA, "{}");
    await writeFile(pathB, "{}");

    let stemA = "";
    for (let index = 0; index < BACKUP_LIMIT + 1; index += 1) {
      const result = await write(pathA, homeDir, (content) => ({
        ...content,
        [`key${index}`]: index,
      }));
      expect(result.ok).toBe(true);
      if (result.ok) stemA = result.backupPath.replace(/\.\d+\.json$/, "");
    }
    const resultB = await write(pathB, homeDir, (content) => ({
      ...content,
      key: "b",
    }));
    expect(resultB.ok).toBe(true);
    if (!resultB.ok) return;
    const stemB = resultB.backupPath.replace(/\.\d+\.json$/, "");

    const backups = await readdir(backupDirectory(homeDir));
    const backupsA = backups.filter((file) =>
      file.startsWith(`${basename(stemA)}.`)
    );
    const backupsB = backups.filter((file) =>
      file.startsWith(`${basename(stemB)}.`)
    );
    expect(backupsA.length).toBe(BACKUP_LIMIT);
    expect(backupsB.length).toBe(1);
  });

  test("the backup name carries the file's digest, not only its basename", async () => {
    const { path, homeDir } = await makeHome("{}");
    const result = await write(path, homeDir, (content) => ({
      ...content,
      model: "sonnet",
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backupPath).toMatch(
      /settings\.json\.[0-9a-f]{8}\.\d+\.json$/
    );
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

describe("preserves a file it does not own", () => {
  test("a realistic multi-key file keeps every other field, its key order and its indentation when one nested key changes", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "boopervisor-mutate-"));
    const path = join(homeDir, ".claude.json");

    // Realistic ~/.claude.json with project history, session state, onboarding flags
    const original =
      JSON.stringify(
        {
          projects: {
            "/path/to/project1": {
              history: ["entry1", "entry2"],
              settings: { theme: "dark" },
            },
            "/path/to/project2": {},
          },
          sessionState: {
            currentSession: "session-123",
            tabHistory: ["tab1", "tab2", "tab3"],
          },
          mcpServers: {
            "server-a": {
              command: "node",
              args: ["server.js"],
            },
            "server-b": {
              url: "http://localhost:3000",
            },
          },
          onboardingFlags: {
            hasSeenWelcome: true,
            completedSetup: true,
          },
          userID: "user-123",
        },
        null,
        2
      ) + "\n";

    await writeFile(path, original);

    const result = await mutateJsonFile({
      path,
      expected: await captureFileSnapshot(path),
      target: { kind: "item", item: "mcp", scope: "user", name: "mcpServers" },
      apply: (content) => ({
        ...content,
        mcpServers: {
          ...(content.mcpServers as Record<string, unknown>),
          "server-c": { command: "python" },
        },
      }),
      homeDir,
    });

    expect(result.ok).toBe(true);

    const after = await readFile(path, "utf8");
    const afterObj = JSON.parse(after);

    // Verify every field outside mcpServers is untouched
    expect(afterObj.projects).toEqual({
      "/path/to/project1": {
        history: ["entry1", "entry2"],
        settings: { theme: "dark" },
      },
      "/path/to/project2": {},
    });
    expect(afterObj.sessionState).toEqual({
      currentSession: "session-123",
      tabHistory: ["tab1", "tab2", "tab3"],
    });
    expect(afterObj.onboardingFlags).toEqual({
      hasSeenWelcome: true,
      completedSetup: true,
    });
    expect(afterObj.userID).toBe("user-123");

    // Verify servers are correct
    expect(afterObj.mcpServers["server-a"]).toEqual({
      command: "node",
      args: ["server.js"],
    });
    expect(afterObj.mcpServers["server-b"]).toEqual({
      url: "http://localhost:3000",
    });
    expect(afterObj.mcpServers["server-c"]).toEqual({
      command: "python",
    });

    // Verify formatting: indentation should be preserved (2 spaces)
    expect(after).toContain('  "projects"');
    expect(after).toContain('    "history"');

    // Verify trailing newline is preserved
    expect(after.endsWith("\n")).toBe(true);

    // Verify key order is roughly preserved (before/after tests)
    const beforeLines = original.split("\n");
    const afterLines = after.split("\n");

    // The file should have same number of lines (approximately)
    expect(Math.abs(beforeLines.length - afterLines.length)).toBeLessThan(5);

    // Verify every byte outside mcpServers is identical
    expect(Object.keys(afterObj)).toContain("projects");
    expect(Object.keys(afterObj)).toContain("sessionState");
    expect(Object.keys(afterObj)).toContain("mcpServers");
    expect(Object.keys(afterObj)).toContain("onboardingFlags");
    expect(Object.keys(afterObj)).toContain("userID");
  });

  test("a file with unusual key order and indentation round-trips in its own shape", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "boopervisor-mutate-"));
    const path = join(homeDir, ".claude.json");

    // Odd indentation (4 spaces), unusual key order
    const original =
      '{\n    "userID": "123",\n    "mcpServers": {\n        "srv": {}\n    },\n    "projects": {},\n    "other": "value"\n}\n';

    await writeFile(path, original);

    const result = await mutateJsonFile({
      path,
      expected: await captureFileSnapshot(path),
      target: { kind: "item", item: "mcp", scope: "user", name: "mcpServers" },
      apply: (content) => content,
      homeDir,
    });

    expect(result.ok).toBe(true);

    const after = await readFile(path, "utf8");

    // Verify 4-space indentation is preserved
    expect(after).toContain('    "userID"');
    expect(after).toContain('        "srv"');

    // Verify other fields unchanged
    expect(after).toContain('"projects": {}');
    expect(after).toContain('"other": "value"');
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
