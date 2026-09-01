"use server";

import { revalidatePath } from "next/cache";

import { getSelectedScope } from "@/lib/scope/server";
import { readChangeItemStateForm } from "./change-state";
import { setItemState } from "./set-state";
import type { ItemType } from "./item-state";

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
  const selected = await getSelectedScope();
  const request = readChangeItemStateForm(formData, selected);
  if (!request.ok) return { error: request.error };

  const result = await setItemState({
    type: request.type,
    name: request.name,
    state: request.state,
    scope: request.scope,
    location: request.location,
    source: request.source,
    expectedSettings: request.expectedSettings,
    expectedArchive: request.expectedArchive,
  });
  if (result.error) return result;

  revalidatePath(PAGES[request.type]);
  return {};
}
