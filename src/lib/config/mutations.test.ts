import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  appendMutationLog,
  MUTATION_LOG_LIMIT_BYTES,
  mutationLogPath,
  readMutationLog,
  rotatedMutationLogPath,
  type MutationRecord,
} from "./mutations";

function record(key: string): MutationRecord {
  return {
    timestamp: new Date().toISOString(),
    target: { kind: "setting", scope: "user", key },
    path: "/home/x/.claude/settings.json",
    backupPath: "/home/x/.claude/.boopervisor-backups/settings.json.1.json",
    before: "{}",
    after: `{"${key}":true}`,
  };
}

describe("the mutation log", () => {
  test("appends and reads back, newest first", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "boopervisor-log-"));
    await appendMutationLog(record("first"), homeDir);
    await appendMutationLog(record("second"), homeDir);

    const records = await readMutationLog(homeDir);
    expect(records.map((entry) => entry.after)).toEqual([
      '{"second":true}',
      '{"first":true}',
    ]);
  });

  test("an absent log reads as no mutations", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "boopervisor-log-"));
    expect(await readMutationLog(homeDir)).toEqual([]);
  });

  test("a truncated line is skipped rather than losing the whole log", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "boopervisor-log-"));
    await appendMutationLog(record("first"), homeDir);
    await writeFile(mutationLogPath(homeDir), '{"partial', { flag: "a" });

    expect(
      (await readMutationLog(homeDir)).map((entry) => entry.after)
    ).toEqual(['{"first":true}']);
  });

  test("creates the log as private, not world-readable", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "boopervisor-log-"));
    await appendMutationLog(record("first"), homeDir);

    const stats = await stat(mutationLogPath(homeDir));
    expect(stats.mode & 0o777).toBe(0o600);
  });
});

describe("rotation", () => {
  test("a log below the limit is appended to and not rotated", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "boopervisor-log-"));
    await appendMutationLog(record("first"), homeDir);
    await appendMutationLog(record("second"), homeDir);

    await expect(stat(rotatedMutationLogPath(homeDir))).rejects.toThrow();
    expect(
      (await readMutationLog(homeDir)).map((entry) => entry.after)
    ).toEqual(['{"second":true}', '{"first":true}']);
  });

  test("a log at or above the limit is rotated before the next append", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "boopervisor-log-"));
    const oldContent = `${"x".repeat(MUTATION_LOG_LIMIT_BYTES)}\n`;
    await mkdir(join(homeDir, ".claude"), { recursive: true });
    await writeFile(mutationLogPath(homeDir), oldContent);

    await appendMutationLog(record("new"), homeDir);

    expect(await readFile(rotatedMutationLogPath(homeDir), "utf8")).toBe(
      oldContent
    );
    expect(
      (await readMutationLog(homeDir)).map((entry) => entry.after)
    ).toEqual(['{"new":true}']);
  });

  test("readMutationLog after a rotation returns only the current file's records", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "boopervisor-log-"));
    const oldContent = `${JSON.stringify(record("old"))}\n${"x".repeat(MUTATION_LOG_LIMIT_BYTES)}\n`;
    await mkdir(join(homeDir, ".claude"), { recursive: true });
    await writeFile(mutationLogPath(homeDir), oldContent);

    await appendMutationLog(record("new"), homeDir);

    expect(
      (await readMutationLog(homeDir)).map((entry) => entry.after)
    ).toEqual(['{"new":true}']);
  });

  test("rotating twice leaves exactly one rotated file", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "boopervisor-log-"));
    const big = `${"x".repeat(MUTATION_LOG_LIMIT_BYTES)}\n`;
    await mkdir(join(homeDir, ".claude"), { recursive: true });
    await writeFile(mutationLogPath(homeDir), big);
    await appendMutationLog(record("first-rotation"), homeDir);

    await writeFile(mutationLogPath(homeDir), big);
    await appendMutationLog(record("second-rotation"), homeDir);

    expect(await readFile(rotatedMutationLogPath(homeDir), "utf8")).toBe(big);
    expect(
      (await readMutationLog(homeDir)).map((entry) => entry.after)
    ).toEqual(['{"second-rotation":true}']);
  });
});
