import { appendFile, mkdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { Scope } from "@/lib/catalog";

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

/** Append-only JSONL, so a mutation is never lost to a rewrite of the whole log. */
export function mutationLogPath(home: string = homedir()): string {
  return join(home, ".claude", ".boopervisor-mutations.jsonl");
}

export async function appendMutationLog(
  record: MutationRecord,
  homeDir?: string
): Promise<void> {
  const path = mutationLogPath(homeDir);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, "utf8");
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
