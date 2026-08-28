import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * `~/.claude.json`, which holds the `projects` map among much else Claude Code owns.
 * It is not part of the settings merge.
 */
export function claudeJsonPath(home: string = homedir()): string {
  return join(home, ".claude.json");
}

/**
 * The project directories Claude Code has recorded. Claude Code owns this file and writes
 * to it constantly, so anything unexpected in it is reported as no projects rather than
 * thrown: the switcher still works, it just lists nothing.
 */
export function parseProjectPaths(text: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed === null) return [];
  const projects = (parsed as { projects?: unknown }).projects;
  if (
    typeof projects !== "object" ||
    projects === null ||
    Array.isArray(projects)
  ) {
    return [];
  }
  return Object.keys(projects);
}

/** The same, from disk. An absent or unreadable file reports no projects. */
export async function readProjectPaths(path: string): Promise<string[]> {
  try {
    return parseProjectPaths(await readFile(path, "utf8"));
  } catch {
    return [];
  }
}

/** Why a manually entered directory can or cannot be used as a scope. */
export type ProjectDirectoryCheck =
  "ok" | "not-absolute" | "missing" | "not-a-directory";

/**
 * Validates a directory typed by hand. Only the path given is looked at — no directory is
 * enumerated looking for projects.
 */
export async function checkProjectDirectory(
  path: string
): Promise<ProjectDirectoryCheck> {
  if (!path.trim().startsWith("/")) return "not-absolute";
  try {
    const stats = await stat(path);
    return stats.isDirectory() ? "ok" : "not-a-directory";
  } catch {
    return "missing";
  }
}
