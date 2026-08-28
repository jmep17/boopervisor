import { homedir } from "node:os";
import { join } from "node:path";
import { captureFileSnapshot } from "@/lib/config/json-file";
import type { Scope } from "@/lib/catalog";

/**
 * The type of item: MCP server, skill, or plugin.
 */
export type ItemType = "mcp" | "skill" | "plugin";

/**
 * The state of an item: enabled (Claude Code will load it), disabled (Claude Code knows
 * about it but won't load it, via Claude Code's own mechanism), or archived (Boopervisor
 * hides it from the main listing and holds it disabled).
 */
export type ItemState = "enabled" | "disabled" | "archived";

/**
 * An item archived in Boopervisor. Keyed by item type, scope, project (optional), and name.
 */
export interface ArchivedItem {
  type: ItemType;
  scope: Scope;
  project?: string;
  name: string;
  archivedAt: string; // ISO 8601
}

/**
 * The complete archival store, mapping archived items by type/scope/project/name.
 */
export interface ItemStateStore {
  archivedItems: Record<string, ArchivedItem>;
}

/**
 * Path to Boopervisor's own state file holding archived items.
 */
export function archivedItemsPath(home: string = homedir()): string {
  return join(home, ".claude", "boopervisor.json");
}

/**
 * Read the current archival state from disk.
 */
export async function readItemState(
  home: string = homedir()
): Promise<ItemStateStore> {
  const snapshot = await captureFileSnapshot(archivedItemsPath(home));
  if (!snapshot.exists || !snapshot.content.archivedItems) {
    return { archivedItems: {} };
  }
  return {
    archivedItems: snapshot.content.archivedItems as Record<
      string,
      ArchivedItem
    >,
  };
}

/**
 * Generate a unique key for an item in the archive.
 * Format: type:scope[:project]:name (project is included only if provided).
 */
export function itemKey(
  type: ItemType,
  scope: Scope,
  name: string,
  project?: string
): string {
  if (project) {
    return `${type}:${scope}:${project}:${name}`;
  }
  return `${type}:${scope}:${name}`;
}

/**
 * Check if an item is archived.
 */
export async function isArchived(
  type: ItemType,
  scope: Scope,
  name: string,
  project?: string,
  home: string = homedir()
): Promise<boolean> {
  const state = await readItemState(home);
  const key = itemKey(type, scope, name, project);
  return key in state.archivedItems;
}
