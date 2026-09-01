import type { Scope } from "@/lib/catalog";
import { captureFileSnapshot } from "@/lib/config/json-file";
import type { McpSource } from "@/lib/config/mcp-servers";
import { mutateJsonFile, type ExpectedFile } from "@/lib/config/mutate";
import { mutateSetting } from "@/lib/config/mutate-setting";
import {
  readScopeSettings,
  settingFilePath,
  type SettingsLocation,
} from "@/lib/config/settings";
import { mcpMechanismFor, mechanismFor } from "./mechanism";
import {
  archivalName,
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
 * stale-checked against the tokens the caller took when it read the files — not against a
 * snapshot taken here, which could never fail. The two files cannot be written atomically,
 * so both tokens are checked before either write, rather than one write happening only for
 * the second to be refused and leave the item half-changed.
 */
export async function setItemState({
  type,
  name,
  state,
  scope,
  location,
  source,
  expectedSettings,
  expectedArchive,
}: {
  type: ItemType;
  name: string;
  state: ItemState;
  /** The scope the header selects, which is where a disable is written. */
  scope: Scope;
  location: SettingsLocation;
  /** For an MCP server, where it is defined. Chooses the disabling mechanism. */
  source?: McpSource;
  /** What the settings file looked like when the page read it. */
  expectedSettings: ExpectedFile;
  /** What `~/.claude/boopervisor.json` looked like when the page read it. */
  expectedArchive: ExpectedFile;
}): Promise<{ error?: string }> {
  const archived = state === "archived";
  const disable = archived || state === "disabled";

  const staleness = await refuseIfStale(
    scope,
    location,
    expectedSettings,
    expectedArchive
  );
  if (staleness) return { error: staleness };

  const settingsProblem = await writeDisabled(
    type,
    name,
    scope,
    location,
    disable,
    expectedSettings,
    source
  );
  if (settingsProblem) return { error: settingsProblem };

  const archivalProblem = await writeArchived(
    type,
    // A local and a `.mcp.json` server can share a name in the same project; the archive
    // key must not conflate them, so a local server's archive name carries its source.
    archivalName(name, source),
    scope,
    location,
    archived,
    expectedArchive
  );
  return archivalProblem ? { error: archivalProblem } : {};
}

/**
 * Both files a state change touches, checked before either is written. Two files cannot be
 * written atomically, so the refusal happens while nothing has been touched: a stale token
 * that would have failed the second write no longer leaves the first one applied.
 */
async function refuseIfStale(
  scope: Scope,
  location: SettingsLocation,
  expectedSettings: ExpectedFile,
  expectedArchive: ExpectedFile
): Promise<string | undefined> {
  const settingsPath = settingFilePath(scope, location);
  const settingsSnapshot = await captureFileSnapshot(settingsPath);
  if (
    settingsSnapshot.hash !== expectedSettings.hash ||
    settingsSnapshot.mtimeMs !== expectedSettings.mtimeMs
  ) {
    return `${settingsPath} changed on disk after Boopervisor read it. Reload and try again.`;
  }

  const archivePath = archivedItemsPath(location.homeDir);
  const archiveSnapshot = await captureFileSnapshot(archivePath);
  if (
    archiveSnapshot.hash !== expectedArchive.hash ||
    archiveSnapshot.mtimeMs !== expectedArchive.mtimeMs
  ) {
    return `${archivePath} changed on disk after Boopervisor read it. Reload and try again.`;
  }

  return undefined;
}

/** The item's entry in the settings key that disables its type, added or removed. */
async function writeDisabled(
  type: ItemType,
  name: string,
  scope: Scope,
  location: SettingsLocation,
  disabled: boolean,
  expectedSettings: ExpectedFile,
  source?: McpSource
): Promise<string | undefined> {
  const mechanism =
    type === "mcp" && source
      ? mcpMechanismFor(source)
      : mechanismFor(type, scope);
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
    expected: expectedSettings,
  });
  return result.ok ? undefined : result.message;
}

/** Boopervisor's own record that the user has put this item away. */
async function writeArchived(
  type: ItemType,
  name: string,
  scope: Scope,
  location: SettingsLocation,
  archived: boolean,
  expectedArchive: ExpectedFile
): Promise<string | undefined> {
  const path = archivedItemsPath(location.homeDir);
  const snapshot = await captureFileSnapshot(path);
  const key = itemKey(type, scope, name, location.projectRoot);
  const existing = asRecord(snapshot.content.archivedItems);
  if (archived === key in existing) return undefined;

  const result = await mutateJsonFile({
    path,
    expected: expectedArchive,
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
