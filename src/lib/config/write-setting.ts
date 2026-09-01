import { getSetting, type Scope } from "@/lib/catalog";
import type { ScopeSelection } from "@/lib/scope/scope";
import type { ExpectedFile } from "./mutate";
import { decodeExpectedFile } from "./mutate";
import type { SettingsLocation } from "./settings";
import { parseValueForSetting } from "./value-form";

export type WriteSettingRequest =
  | {
      ok: true;
      scope: Scope;
      location: SettingsLocation;
      key: string;
      value: unknown;
      expected: ExpectedFile;
    }
  | { ok: false; error: string };

/**
 * What a submitted settings form asks for, decided without touching the disk or the
 * cookie store: the selection is passed in, so this is testable and the Server Action
 * stays a wrapper around it.
 */
export function readWriteSettingForm(
  formData: FormData,
  selected: ScopeSelection
): WriteSettingRequest {
  const key = String(formData.get("key") ?? "").trim();
  if (!key) return { ok: false, error: "No setting named." };

  const scope = String(formData.get("scope") ?? "") as Scope;
  if (scope !== "user" && scope !== "project" && scope !== "local") {
    return { ok: false, error: "That scope cannot be written." };
  }
  if (scope !== "user" && selected.kind !== "project") {
    return {
      ok: false,
      error: "Select a project before editing its settings.",
    };
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
  if (!parsed.ok) return { ok: false, error: parsed.problem };

  return {
    ok: true,
    scope,
    location,
    key,
    value: parsed.value,
    expected: decodeExpectedFile(String(formData.get("expected") ?? "")),
  };
}
