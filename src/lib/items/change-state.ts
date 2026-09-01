import type { Scope } from "@/lib/catalog";
import type { McpSource } from "@/lib/config/mcp-servers";
import { decodeExpectedFile, type ExpectedFile } from "@/lib/config/mutate";
import type { SettingsLocation } from "@/lib/config/settings";
import type { ScopeSelection } from "@/lib/scope/scope";
import type { ItemState, ItemType } from "./item-state";

const ITEM_TYPES: readonly ItemType[] = ["mcp", "skill", "plugin"];

export type ChangeItemStateRequest =
  | {
      ok: true;
      type: ItemType;
      name: string;
      state: ItemState;
      scope: Scope;
      location: SettingsLocation;
      source: McpSource | undefined;
      expectedSettings: ExpectedFile;
      expectedArchive: ExpectedFile;
    }
  | { ok: false; error: string };

/**
 * What a submitted item-state form asks for, decided without touching the disk: the
 * selection is passed in, so this is testable and the Server Action stays a wrapper
 * around it.
 */
export function readChangeItemStateForm(
  formData: FormData,
  selected: ScopeSelection
): ChangeItemStateRequest {
  const type = String(formData.get("type") ?? "") as ItemType;
  const name = String(formData.get("name") ?? "");
  const state = String(formData.get("state") ?? "") as ItemState;
  const sourceField = formData.get("source");
  const source =
    sourceField === "user" ||
    sourceField === "project" ||
    sourceField === "local"
      ? (sourceField as McpSource)
      : undefined;

  if (!ITEM_TYPES.includes(type))
    return {
      ok: false,
      error: "That is not a kind of item Boopervisor manages.",
    };
  if (!name) return { ok: false, error: "No item named." };
  if (state !== "enabled" && state !== "disabled" && state !== "archived") {
    return { ok: false, error: "That is not a state an item can be in." };
  }

  const location: SettingsLocation = {
    projectRoot: selected.kind === "project" ? selected.path : undefined,
  };
  const scope: Scope = selected.kind === "project" ? "project" : "user";

  return {
    ok: true,
    type,
    name,
    state,
    scope,
    location,
    source,
    expectedSettings: decodeExpectedFile(
      String(formData.get("expectedSettings") ?? "")
    ),
    expectedArchive: decodeExpectedFile(
      String(formData.get("expectedArchive") ?? "")
    ),
  };
}
