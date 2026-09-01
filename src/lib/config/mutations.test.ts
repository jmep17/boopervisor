import { describe, expect, test } from "bun:test";
import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  appendMutationLog,
  mutationLogPath,
  readMutationLog,
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
