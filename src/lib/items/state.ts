import type { Scope } from "@/lib/catalog";
import type { SettingsResolution } from "@/lib/config/effective";
import type { McpSource } from "@/lib/config/mcp-servers";
import { isArchived, type ItemState, type ItemType } from "./item-state";
import { isDisabledBySettings } from "./mechanism";

/**
 * What state one item is in. Archival wins the label: an archived item is held disabled,
 * and saying "disabled" of it would hide that the user put it away.
 */
export async function itemState(
  type: ItemType,
  name: string,
  scope: Scope,
  resolution: SettingsResolution,
  project?: string,
  source?: McpSource
): Promise<ItemState> {
  if (await isArchived(type, scope, name, project)) return "archived";
  return isDisabledBySettings(type, name, scope, resolution, source)
    ? "disabled"
    : "enabled";
}
