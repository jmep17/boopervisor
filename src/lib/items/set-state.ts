import type { Scope } from "@/lib/catalog";
import { captureFileSnapshot } from "@/lib/config/json-file";
import { mutateJsonFile } from "@/lib/config/mutate";
import { mutateSetting, snapshotScope } from "@/lib/config/mutate-setting";
import {
  readScopeSettings,
  type SettingsLocation,
} from "@/lib/config/settings";
import { mechanismFor } from "./mechanism";
import {
  archivedItemsPath,
  itemKey,
  type ItemState,
  type ItemType,
} from "./item-state";

/**
 * Moves one item between enabled, disabled and archived, uniformly across skills, plugins
 * and MCP servers.
 *
 * Disabling writes Claude Code's own settings key for the item type. Archival writes only
 * Boopervisor's own file, and holds the item disabled as well — an archived item is one the
 * user has put away, so it must not still be loading. Neither ever touches the item's own
 * files. Both go through the shared write path, so both are validated, backed up and
 * stale-checked.
 */
export async function setItemState({
  type,
  name,
  state,
  scope,
  location,
}: {
  type: ItemType;
  name: string;
  state: ItemState;
  /** The scope the header selects, which is where a disable is written. */
  scope: Scope;
  location: SettingsLocation;
}): Promise<{ error?: string }> {
  const archived = state === "archived";
  const disable = archived || state === "disabled";

  const settingsProblem = await writeDisabled(
    type,
    name,
    scope,
    location,
    disable
  );
  if (settingsProblem) return { error: settingsProblem };

  const archivalProblem = await writeArchived(
    type,
    name,
    scope,
    location,
    archived
  );
  return archivalProblem ? { error: archivalProblem } : {};
}

/** The item's entry in the settings key that disables its type, added or removed. */
async function writeDisabled(
  type: ItemType,
  name: string,
  scope: Scope,
  location: SettingsLocation,
  disabled: boolean
): Promise<string | undefined> {
  const mechanism = mechanismFor(type, scope);
  const current = (await readScopeSettings(scope, location))[mechanism.key];

  const next = disabled
    ? mechanism.disable(current, name)
    : mechanism.enable(current, name);
  if (JSON.stringify(next ?? null) === JSON.stringify(current ?? null))
    return undefined;

  const result = await mutateSetting({
    scope,
    location,
    key: mechanism.key,
    value: next,
    expected: await snapshotScope(scope, location),
  });
  return result.ok ? undefined : result.message;
}

/** Boopervisor's own record that the user has put this item away. */
async function writeArchived(
  type: ItemType,
  name: string,
  scope: Scope,
  location: SettingsLocation,
  archived: boolean
): Promise<string | undefined> {
  const path = archivedItemsPath(location.homeDir);
  const snapshot = await captureFileSnapshot(path);
  const key = itemKey(type, scope, name, location.projectRoot);
  const existing = asRecord(snapshot.content.archivedItems);
  if (archived === key in existing) return undefined;

  const result = await mutateJsonFile({
    path,
    expected: snapshot,
    target: {
      kind: "item",
      item: type,
      scope,
      project: location.projectRoot,
      name,
    },
    apply: (content) => {
      const items = { ...asRecord(content.archivedItems) };
      if (archived) {
        items[key] = {
          type,
          scope,
          project: location.projectRoot,
          name,
          archivedAt: new Date().toISOString(),
        };
      } else {
        delete items[key];
      }
      return { ...content, archivedItems: items };
    },
    homeDir: location.homeDir,
  });
  return result.ok ? undefined : result.message;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
