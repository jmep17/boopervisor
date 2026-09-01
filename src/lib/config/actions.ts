"use server";

import { revalidatePath } from "next/cache";

import { getSelectedScope } from "@/lib/scope/server";
import { mutateSetting } from "./mutate-setting";
import { readWriteSettingForm } from "./write-setting";

export interface WriteSettingState {
  ok?: boolean;
  error?: string;
}

/**
 * Writes one key to the scope selected in the header. The form carries the key, the value
 * as text and the token identifying the file it was composed against; everything else —
 * which file that is, whether the value is allowed, the backup — belongs to the server.
 */
export async function writeSetting(
  _previous: WriteSettingState,
  formData: FormData
): Promise<WriteSettingState> {
  const selected = await getSelectedScope();
  const request = readWriteSettingForm(formData, selected);
  if (!request.ok) return { error: request.error };

  const result = await mutateSetting({
    scope: request.scope,
    location: request.location,
    key: request.key,
    value: request.value,
    expected: request.expected,
  });
  if (!result.ok) return { error: result.message };

  revalidatePath("/settings");
  return { ok: true };
}
