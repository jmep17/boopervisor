"use server";

import { revalidatePath } from "next/cache";

import type { SettingsLocation } from "@/lib/config/settings";
import { getSelectedScope } from "@/lib/scope/server";
import { setItemState } from "./set-state";
import type { ItemState, ItemType } from "./item-state";

export interface ItemStateResult {
  error?: string;
}

const PAGES: Record<ItemType, string> = {
  mcp: "/mcp",
  skill: "/skills",
  plugin: "/plugins",
};

/**
 * The one Server Action behind every item's state controls. The form names the item and
 * the state it should be in; which file that touches is the server's business.
 */
export async function changeItemState(
  _previous: ItemStateResult,
  formData: FormData
): Promise<ItemStateResult> {
  const type = String(formData.get("type") ?? "") as ItemType;
  const name = String(formData.get("name") ?? "");
  const state = String(formData.get("state") ?? "") as ItemState;

  if (!(type in PAGES))
    return { error: "That is not a kind of item Boopervisor manages." };
  if (!name) return { error: "No item named." };
  if (state !== "enabled" && state !== "disabled" && state !== "archived") {
    return { error: "That is not a state an item can be in." };
  }

  const selected = await getSelectedScope();
  const location: SettingsLocation = {
    projectRoot: selected.kind === "project" ? selected.path : undefined,
  };
  const scope = selected.kind === "project" ? "project" : "user";

  const result = await setItemState({ type, name, state, scope, location });
  if (result.error) return result;

  revalidatePath(PAGES[type]);
  return {};
}
