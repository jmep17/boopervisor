"use server";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { revalidatePath } from "next/cache";

import { backupDirectory, mutateJsonFile } from "@/lib/config/mutate";
import { decodeExpectedFile } from "@/lib/config/mutate";
import { parseJsonObject } from "@/lib/config/json-file";

export interface RestoreState {
  ok?: boolean;
  error?: string;
}

/**
 * Restores a file from a backup. The form carries only the backup path; the server
 * verifies it exists under the backups directory, reads it, and uses mutateJsonFile
 * to apply it as a mutation with stale checking and its own backup.
 */
export async function restoreFromBackup(
  _previous: RestoreState,
  formData: FormData
): Promise<RestoreState> {
  const backupPath = String(formData.get("backupPath") ?? "").trim();
  if (!backupPath) return { error: "No backup specified." };

  const backupDir = backupDirectory();

  // Verify the backup path is under the backups directory to prevent directory traversal
  const resolvedBackupPath = resolve(backupPath);
  const resolvedBackupDir = resolve(backupDir);
  if (!resolvedBackupPath.startsWith(resolvedBackupDir + "/")) {
    return { error: "Invalid backup path." };
  }

  // Read the backup file
  let backupText: string;
  try {
    backupText = await readFile(resolvedBackupPath, "utf8");
  } catch {
    return { error: "Backup file not found or could not be read." };
  }

  // Extract the original file path from the form
  const targetPath = String(formData.get("targetPath") ?? "").trim();
  if (!targetPath) return { error: "No target file specified." };

  // Decode the expected state from the form
  const expected = decodeExpectedFile(String(formData.get("expected") ?? ""));

  // Parse the backup contents
  const { content: backupContent } = parseJsonObject(backupText);

  // Apply the restore as a mutation
  const result = await mutateJsonFile({
    path: targetPath,
    expected,
    target: { kind: "restore", backupPath: resolvedBackupPath },
    apply: () => backupContent,
  });

  if (!result.ok) return { error: result.message };

  revalidatePath("/history");
  return { ok: true };
}
