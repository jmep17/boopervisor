import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { backupDirectory } from "@/lib/config/mutate";
import { parseJsonObject, type JsonObject } from "@/lib/config/json-file";
import { readMutationLog } from "@/lib/config/mutations";

export type ResolvedRestore =
  | { ok: true; backupPath: string; targetPath: string; content: JsonObject }
  | { ok: false; error: string };

/**
 * What a restore is allowed to do, decided entirely from the backup path.
 *
 * The file a backup may be written to is the one the mutation log recorded it
 * against, never one the form names: the browser says which backup to restore,
 * and nothing else. A backup that will not parse as a JSON object is refused
 * rather than written as `{}`, which would empty the very file it should rescue.
 */
export async function resolveRestore(
  backupPath: string,
  homeDir?: string
): Promise<ResolvedRestore> {
  const trimmed = backupPath.trim();
  if (!trimmed) return { ok: false, error: "No backup specified." };

  const resolvedBackupPath = resolve(trimmed);
  const resolvedBackupDir = resolve(backupDirectory(homeDir));
  if (!resolvedBackupPath.startsWith(resolvedBackupDir + "/")) {
    return { ok: false, error: "Invalid backup path." };
  }

  const log = await readMutationLog(homeDir);
  const record = log.find(
    (entry) => resolve(entry.backupPath) === resolvedBackupPath
  );
  if (!record) {
    return {
      ok: false,
      error:
        "That backup is not in the mutation log, so Boopervisor does not know which file it belongs to.",
    };
  }

  let backupText: string;
  try {
    backupText = await readFile(resolvedBackupPath, "utf8");
  } catch {
    return { ok: false, error: "Backup file not found or could not be read." };
  }

  const { content, state } = parseJsonObject(backupText);
  if (state === "invalid-json") {
    return {
      ok: false,
      error:
        "That backup is not valid JSON. Boopervisor will not restore a file it cannot read.",
    };
  }

  return {
    ok: true,
    backupPath: resolvedBackupPath,
    targetPath: record.path,
    content,
  };
}
