"use server";

import { revalidatePath } from "next/cache";

import { getSetting, type Scope } from "@/lib/catalog";
import { getSelectedScope } from "@/lib/scope/server";
import { decodeExpectedFile } from "./mutate";
import { mutateSetting } from "./mutate-setting";
import { parseValueForSetting } from "./value-form";

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
  const key = String(formData.get("key") ?? "").trim();
  if (!key) return { error: "No setting named." };

  const selected = await getSelectedScope();
  const scope = String(formData.get("scope") ?? "") as Scope;
  if (scope !== "user" && scope !== "project" && scope !== "local") {
    return { error: "That scope cannot be written." };
  }
  if (scope !== "user" && selected.kind !== "project") {
    return { error: "Select a project before editing its settings." };
  }
  const location = {
    projectRoot: selected.kind === "project" ? selected.path : undefined,
  };

  const raw = formData.get("value");
  const parsed = parseValueForSetting(
    raw === null ? undefined : String(raw),
    getSetting(key),
    formData.get("unset") !== null
  );
  if (!parsed.ok) return { error: parsed.problem };

  const result = await mutateSetting({
    scope,
    location,
    key,
    value: parsed.value,
    expected: decodeExpectedFile(String(formData.get("expected") ?? "")),
  });
  if (!result.ok) return { error: result.message };

  revalidatePath("/settings");
  return { ok: true };
}
