"use server";

import { revalidatePath } from "next/cache";

import { decodeExpectedFile, mutateJsonFile } from "@/lib/config/mutate";
import { resolveRestore } from "@/lib/history/restore";

export interface RestoreState {
  ok?: boolean;
  error?: string;
}

/**
 * Restores a file from a backup. The form carries only the backup path; resolveRestore
 * looks up the file it belongs to and its parsed contents from the mutation log, and
 * mutateJsonFile applies the result as a mutation with stale checking and its own backup.
 */
export async function restoreFromBackup(
  _previous: RestoreState,
  formData: FormData
): Promise<RestoreState> {
  const backupPath = String(formData.get("backupPath") ?? "").trim();
  const resolution = await resolveRestore(backupPath);
  if (!resolution.ok) return { error: resolution.error };

  const expected = decodeExpectedFile(String(formData.get("expected") ?? ""));

  const result = await mutateJsonFile({
    path: resolution.targetPath,
    expected,
    target: { kind: "restore", backupPath: resolution.backupPath },
    apply: () => resolution.content,
  });

  if (!result.ok) return { error: result.message };

  revalidatePath("/history");
  return { ok: true };
}
