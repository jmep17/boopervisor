import { checkProjectDirectory } from "@/lib/config/projects";

const MESSAGES = {
  "not-absolute": "Enter an absolute path, starting with /.",
  missing: "No such directory.",
  "not-a-directory": "That path is a file, not a directory.",
} as const;

/** The directory to add, or why it cannot be added. Checks the path; enumerates nothing. */
export async function checkProjectToAdd(
  path: string
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const trimmed = path.trim();
  if (!trimmed) return { ok: false, error: "Enter a directory path." };

  const check = await checkProjectDirectory(trimmed);
  if (check !== "ok") return { ok: false, error: MESSAGES[check] };

  return { ok: true, path: trimmed };
}

/** The manual-projects list with `path` added, unchanged when it is already there. */
export function withManualProject(
  existing: readonly string[],
  path: string
): string[] {
  if (existing.includes(path)) return [...existing];
  return [...existing, path];
}
