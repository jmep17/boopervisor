import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { appendMutationLog, type MutationRecord } from "@/lib/config/mutations";
import { backupDirectory } from "@/lib/config/mutate";
import { resolveRestore } from "./restore";

const TARGET = { kind: "setting", scope: "user", key: "model" } as const;

async function makeHome(): Promise<string> {
  return mkdtemp(join(tmpdir(), "boopervisor-restore-"));
}

/** Writes a backup file under the home's backups directory and a matching log record for it. */
async function makeBackup(
  homeDir: string,
  options: {
    fileName?: string;
    text: string;
    targetPath?: string;
    timestamp?: string;
  }
): Promise<string> {
  const directory = backupDirectory(homeDir);
  await mkdir(directory, { recursive: true });
  const fileName = options.fileName ?? `settings.json.${Date.now()}.json`;
  const backupPath = join(directory, fileName);
  await writeFile(backupPath, options.text, "utf8");

  const record: MutationRecord = {
    timestamp: options.timestamp ?? new Date().toISOString(),
    target: TARGET,
    path: options.targetPath ?? join(homeDir, ".claude", "settings.json"),
    backupPath,
    before: options.text,
    after: options.text,
  };
  await appendMutationLog(record, homeDir);
  return backupPath;
}

describe("resolveRestore", () => {
  test("resolves the target path from the log rather than anything the caller supplies", async () => {
    const homeDir = await makeHome();
    const targetPath = join(homeDir, ".claude", "settings.json");
    const backupPath = await makeBackup(homeDir, {
      text: '{"model":"opus"}',
      targetPath,
    });

    const result = await resolveRestore(backupPath, homeDir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.targetPath).toBe(targetPath);
    expect(result.content).toEqual({ model: "opus" });
  });

  test("refuses a backup path outside the backups directory", async () => {
    const homeDir = await makeHome();

    const relative = await resolveRestore(
      join(backupDirectory(homeDir), "..", "..", "etc", "hosts"),
      homeDir
    );
    expect(relative).toEqual({ ok: false, error: "Invalid backup path." });

    const absolute = await resolveRestore("/etc/hosts", homeDir);
    expect(absolute).toEqual({ ok: false, error: "Invalid backup path." });
  });

  test("refuses a backup path that is in the backups directory but has no log record", async () => {
    const homeDir = await makeHome();
    const directory = backupDirectory(homeDir);
    await mkdir(directory, { recursive: true });
    const backupPath = join(directory, "settings.json.12345.json");
    await writeFile(backupPath, '{"model":"opus"}', "utf8");

    const result = await resolveRestore(backupPath, homeDir);

    expect(result).toEqual({
      ok: false,
      error:
        "That backup is not in the mutation log, so Boopervisor does not know which file it belongs to.",
    });
  });

  test("refuses a backup whose text is truncated JSON", async () => {
    const homeDir = await makeHome();
    const backupPath = await makeBackup(homeDir, {
      text: '{"model": "opus"',
    });

    const result = await resolveRestore(backupPath, homeDir);

    expect(result).toEqual({
      ok: false,
      error:
        "That backup is not valid JSON. Boopervisor will not restore a file it cannot read.",
    });
  });

  test("accepts an empty backup and returns {} as its content", async () => {
    const homeDir = await makeHome();
    const backupPath = await makeBackup(homeDir, { text: "" });

    const result = await resolveRestore(backupPath, homeDir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toEqual({});
  });

  test("accepts a well-formed backup and returns its parsed content and the recorded target path", async () => {
    const homeDir = await makeHome();
    const targetPath = join(homeDir, ".claude", "settings.json");
    const backupPath = await makeBackup(homeDir, {
      text: '{"model":"sonnet","verbose":true}',
      targetPath,
    });

    const result = await resolveRestore(backupPath, homeDir);

    expect(result).toEqual({
      ok: true,
      backupPath,
      targetPath,
      content: { model: "sonnet", verbose: true },
    });
  });

  test("when two records share a backup path, returns the newest one's target", async () => {
    const homeDir = await makeHome();
    const directory = backupDirectory(homeDir);
    await mkdir(directory, { recursive: true });
    const backupPath = join(directory, "settings.json.99999.json");
    await writeFile(backupPath, '{"model":"opus"}', "utf8");

    const olderTarget = join(homeDir, "old-project", "settings.json");
    const newerTarget = join(homeDir, "new-project", "settings.json");

    await appendMutationLog(
      {
        timestamp: "2026-01-01T00:00:00.000Z",
        target: TARGET,
        path: olderTarget,
        backupPath,
        before: '{"model":"opus"}',
        after: '{"model":"opus"}',
      },
      homeDir
    );
    await appendMutationLog(
      {
        timestamp: "2026-01-02T00:00:00.000Z",
        target: TARGET,
        path: newerTarget,
        backupPath,
        before: '{"model":"opus"}',
        after: '{"model":"opus"}',
      },
      homeDir
    );

    const result = await resolveRestore(backupPath, homeDir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.targetPath).toBe(newerTarget);
  });
});
