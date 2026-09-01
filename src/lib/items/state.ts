import { homedir } from "node:os";

import type { Scope } from "@/lib/catalog";
import type { SettingsResolution } from "@/lib/config/effective";
import type { McpSource } from "@/lib/config/mcp-servers";
import {
  archivalName,
  isArchived,
  type ItemState,
  type ItemType,
} from "./item-state";
import { isDisabledBySettings } from "./mechanism";

/**
 * What state one item is in. Archival wins the label: an archived item is held disabled,
 * and saying "disabled" of it would hide that the user put it away.
 *
 * `home` defaults to the real home directory, as `isArchived` itself does; it exists so
 * this can be tested against a temporary one, the same as every other function here.
 */
export async function itemState(
  type: ItemType,
  name: string,
  scope: Scope,
  resolution: SettingsResolution,
  project?: string,
  source?: McpSource,
  home: string = homedir()
): Promise<ItemState> {
  // A local-scope MCP server is archived under its qualified name (see `archivalName`), so
  // an archival check for one must use it, or it can be shadowed by a same-named .mcp.json
  // server's archival record (or fail to see its own).
  if (await isArchived(type, scope, archivalName(name, source), project, home))
    return "archived";
  return isDisabledBySettings(type, name, scope, resolution, source)
    ? "disabled"
    : "enabled";
}
