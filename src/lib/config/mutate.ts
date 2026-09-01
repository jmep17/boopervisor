import { createHash } from "node:crypto";
import { access, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

import {
  appendMutationLog,
  type MutationRecord,
  type MutationTarget,
} from "./mutations";
import {
  captureFileSnapshot,
  serializeLike,
  type JsonObject,
} from "./json-file";
import type { ValidationResult } from "./validate";

export { captureFileSnapshot } from "./json-file";
export type { FileSnapshot, JsonObject } from "./json-file";

export type MutationResult = MutationOk | MutationError;

export interface MutationOk {
  ok: true;
  backupPath: string;
  record: MutationRecord;
}

export interface MutationError {
  ok: false;
  /** `stale`: the file changed since it was read. `invalid`: validation refused the value. */
  problem: "stale" | "invalid" | "io-error";
  message: string;
}

/** Backups older than this are pruned, per file. */
export const BACKUP_LIMIT = 50;

/**
 * The part of a snapshot a write is checked against. A form carries only this, never the
 * file's contents: the browser has no business holding a copy of the user's configuration.
 */
export interface ExpectedFile {
  hash: string;
  mtimeMs: number;
}

/** The two fields as a form value, and back. Anything unreadable fails the stale check. */
export function encodeExpectedFile(snapshot: ExpectedFile): string {
  return `${snapshot.mtimeMs}:${snapshot.hash}`;
}

export function decodeExpectedFile(value: string | undefined): ExpectedFile {
  const separator = (value ?? "").indexOf(":");
  if (separator === -1) return { hash: "", mtimeMs: -1 };
  return {
    mtimeMs: Number(value!.slice(0, separator)),
    hash: value!.slice(separator + 1),
  };
}

export function backupDirectory(home: string = homedir()): string {
  return join(home, ".claude", ".boopervisor-backups");
}

/**
 * One mutation: a file, the snapshot it was composed against, and a pure change to that
 * file's parsed contents. Every write in Boopervisor goes through this — settings keys,
 * the `mcpServers` key of `~/.claude.json`, item archival, and restores alike.
 */
export interface MutationRequest {
  path: string;
  /** What the file looked like when it was read. A `FileSnapshot` satisfies it. */
  expected: ExpectedFile;
  /** What the change is, for `/history` to render. */
  target: MutationTarget;
  /** Applied to the file's current contents. Must not mutate its argument. */
  apply: (content: JsonObject) => JsonObject;
  /** Refuses the write before anything is touched. Runs on the result of `apply`. */
  validate?: (next: JsonObject) => ValidationResult;
  homeDir?: string;
}

/**
 * Validates, backs up, and writes — refusing rather than throwing for anything expected.
 *
 * The file is reserialised from its parsed contents in the indentation it already used, so
 * keys Boopervisor does not know about keep their values, their order and their formatting.
 */
export async function mutateJsonFile(
  request: MutationRequest
): Promise<MutationResult> {
  const { path, expected, target, apply, validate, homeDir } = request;

  const current = await captureFileSnapshot(path);
  if (current.hash !== expected.hash || current.mtimeMs !== expected.mtimeMs) {
    return {
      ok: false,
      problem: "stale",
      message: `${path} changed on disk after Boopervisor read it. Reload and try again.`,
    };
  }
  if (current.exists && current.state === "invalid-json") {
    return {
      ok: false,
      problem: "invalid",
      message: `${path} is not valid JSON. Boopervisor will not overwrite a file it cannot read.`,
    };
  }

  const next = apply(current.content);
  const validation = validate?.(next);
  if (validation && !validation.ok) {
    return { ok: false, problem: "invalid", message: validation.problem };
  }

  const text = serializeLike(next, current.text);

  try {
    const backupPath = await writeBackup(path, current.text, homeDir);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text, "utf8");

    const record: MutationRecord = {
      timestamp: new Date().toISOString(),
      target,
      path,
      backupPath,
      before: current.text,
      after: text,
    };
    await appendMutationLog(record, homeDir);
    return { ok: true, backupPath, record };
  } catch (error) {
    return {
      ok: false,
      problem: "io-error",
      message: (error as Error).message,
    };
  }
}

/**
 * A copy of the file as it stands, taken before it is touched. An absent file is backed up
 * as empty, so a restore can return it to not existing in substance if not in name.
 *
 * Backups made before the per-file stem existed keep their old `<basename>.<timestamp>.json`
 * name; they match no stem's prune pattern, so they are never pruned again but stay
 * restorable through the mutation log.
 */
async function writeBackup(
  path: string,
  text: string,
  homeDir?: string
): Promise<string> {
  const directory = backupDirectory(homeDir);
  await mkdir(directory, { recursive: true });

  const stem = backupStem(path);
  // A second mutation within the same millisecond would otherwise overwrite the first backup.
  let backupPath = join(directory, `${stem}.${Date.now()}.json`);
  for (let attempt = 0; await exists(backupPath); attempt += 1) {
    backupPath = join(directory, `${stem}.${Date.now() + attempt + 1}.json`);
  }
  await writeFile(backupPath, text, "utf8");
  await pruneBackups(directory, stem);
  return backupPath;
}

/**
 * Backups are named for the file and pruned as a set, so the name must tell two files apart
 * that share a basename — the user's settings.json and every project's. The path's digest
 * does that without putting the whole path in a file name.
 */
function backupStem(path: string): string {
  const digest = createHash("sha1").update(path).digest("hex").slice(0, 8);
  return `${basename(path)}.${digest}`;
}

/** Node-portable existence check, shared by the mutation layer and the History page. */
export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Keeps the most recent `BACKUP_LIMIT` backups of one file. Failing to prune never fails a write. */
async function pruneBackups(directory: string, stem: string): Promise<void> {
  const pattern = new RegExp(`^${escapeForRegExp(stem)}\\.(\\d+)\\.json$`);
  try {
    const matching = (await readdir(directory))
      .map((file) => ({ file, match: pattern.exec(file) }))
      .filter(
        (entry): entry is { file: string; match: RegExpExecArray } =>
          entry.match !== null
      )
      .sort((a, b) => Number(b.match[1]) - Number(a.match[1]));

    for (const { file } of matching.slice(BACKUP_LIMIT)) {
      await rm(join(directory, file), { force: true });
    }
  } catch {
    // A backup that cannot be pruned is still a backup.
  }
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
