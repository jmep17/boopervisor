import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

/** Every file Boopervisor writes holds a JSON object at its root. */
export type JsonObject = Record<string, unknown>;

/**
 * What a file looked like when Boopervisor read it. A mutation carries the snapshot it
 * was composed against, and refuses to write if the file no longer matches it.
 *
 * The hash is of the raw bytes, not of the parsed value: a change Boopervisor never saw
 * is a stale write even when it only moved whitespace around.
 */
export interface FileSnapshot {
  path: string;
  /** False when the file was absent. Writing then still checks: an absent file that has since appeared is stale. */
  exists: boolean;
  /** Milliseconds, or 0 when the file was absent. */
  mtimeMs: number;
  hash: string;
  /** The raw text, empty when absent. */
  text: string;
  /** The parsed object. Empty when the file was absent, empty or not a JSON object. */
  content: JsonObject;
  /** Why `content` is empty, so a page can report the file's state rather than silently showing nothing. */
  state: FileState;
}

export type FileState = "ok" | "missing" | "empty" | "invalid-json";

export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function parseJsonObject(text: string): {
  content: JsonObject;
  state: FileState;
} {
  if (!text.trim()) return { content: {}, state: "empty" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { content: {}, state: "invalid-json" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { content: {}, state: "invalid-json" };
  }
  return { content: parsed as JsonObject, state: "ok" };
}

/** An absent file snapshots as absent rather than failing: most config files start that way. */
export async function captureFileSnapshot(path: string): Promise<FileSnapshot> {
  let text: string;
  let mtimeMs: number;
  try {
    [text, mtimeMs] = await Promise.all([
      readFile(path, "utf8"),
      stat(path).then((stats) => stats.mtimeMs),
    ]);
  } catch {
    return {
      path,
      exists: false,
      mtimeMs: 0,
      hash: hashText(""),
      text: "",
      content: {},
      state: "missing",
    };
  }
  const { content, state } = parseJsonObject(text);
  return {
    path,
    exists: true,
    mtimeMs,
    hash: hashText(text),
    text,
    content,
    state,
  };
}

/**
 * The indentation a file already uses, so a write that changes one key does not reformat
 * every other line of a file Claude Code owns. Two spaces when there is nothing to go on.
 */
export function detectIndent(text: string): string | number {
  const match = /^[^\n]*\{\s*\n(\s+)"/.exec(text);
  if (!match)
    return text.trim().startsWith("{") && !text.includes("\n") ? 0 : 2;
  const indent = match[1].replace(/\r/g, "");
  return indent.includes("\t") ? "\t" : indent.length;
}

/** Serialises in the shape the file already had: its indentation and its trailing newline. */
export function serializeLike(content: JsonObject, original: string): string {
  const body = JSON.stringify(content, null, detectIndent(original));
  const keepsTrailingNewline = original === "" || original.endsWith("\n");
  return keepsTrailingNewline ? `${body}\n` : body;
}
