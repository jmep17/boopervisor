import { appendFile, mkdir, readFile, rename, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { Scope } from "@/lib/catalog";
import { PRIVATE_DIRECTORY, PRIVATE_FILE } from "./mutate";

/** What a mutation changed, in the interface's own words, so `/history` can describe it. */
export type MutationTarget =
  | { kind: "setting"; scope: Scope; project?: string; key: string }
  | {
      kind: "item";
      item: "mcp" | "skill" | "plugin";
      scope: Scope;
      project?: string;
      name: string;
    }
  | { kind: "restore"; backupPath: string };

/**
 * One mutation, holding enough to render a diff and to restore: the file's whole text
 * before and after. Settings files are small and there are at most a few thousand records.
 */
export interface MutationRecord {
  /** ISO 8601. */
  timestamp: string;
  target: MutationTarget;
  path: string;
  backupPath: string;
  before: string;
  after: string;
}

/**
 * Append-only JSONL, so a mutation is never lost to a rewrite of the whole log.
 * `/history` reads this file only — a rotated-out log (see `rotatedMutationLogPath`)
 * stays on disk but falls off the page, which is the accepted trade-off.
 */
export function mutationLogPath(home: string = homedir()): string {
  return join(home, ".claude", ".boopervisor-mutations.jsonl");
}

/** The log is rotated, not rewritten, once it passes this. One previous file is kept. */
export const MUTATION_LOG_LIMIT_BYTES = 5_000_000;

export function rotatedMutationLogPath(home: string = homedir()): string {
  return join(home, ".claude", ".boopervisor-mutations.1.jsonl");
}

/** A log that cannot be rotated is still a log: rotation must never fail a write. */
async function rotateMutationLogIfNeeded(
  path: string,
  homeDir?: string
): Promise<void> {
  try {
    const stats = await stat(path);
    if (stats.size < MUTATION_LOG_LIMIT_BYTES) return;
    await rename(path, rotatedMutationLogPath(homeDir));
  } catch {
    // No log yet, or the rename failed — either way, appending below starts fresh.
  }
}

export async function appendMutationLog(
  record: MutationRecord,
  homeDir?: string
): Promise<void> {
  const path = mutationLogPath(homeDir);
  await mkdir(dirname(path), { recursive: true, mode: PRIVATE_DIRECTORY });
  await rotateMutationLogIfNeeded(path, homeDir);
  await appendFile(path, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    mode: PRIVATE_FILE,
  });
}

/** Newest first, which is the order `/history` lists them in. A malformed line is skipped, not fatal. */
export async function readMutationLog(
  homeDir?: string
): Promise<MutationRecord[]> {
  let text: string;
  try {
    text = await readFile(mutationLogPath(homeDir), "utf8");
  } catch {
    return [];
  }
  const records: MutationRecord[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line) as MutationRecord);
    } catch {
      continue;
    }
  }
  return records.reverse();
}
