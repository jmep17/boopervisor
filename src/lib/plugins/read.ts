import { homedir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

/**
 * Metadata extracted from a plugin.json file.
 */
export interface PluginMetadata {
  name: string;
  version?: string;
  description?: string;
}

/**
 * A plugin with its name, marketplace and metadata from plugin.json.
 */
export interface Plugin {
  /** `plugin-name@marketplace-name`, which is also how `enabledPlugins` names it. */
  id: string;
  name: string;
  marketplace: string;
  path: string;
  /** The scope the plugin was installed at, which is not the scope that enables it. */
  installedScope: string;
  /** Null when `plugin.json` is absent or unreadable; the plugin is still listed. */
  metadata: PluginMetadata | null;
  /** The manifest actually read, which is not always where one would first look for it. */
  manifestPath?: string;
}

/**
 * The structure of ~/.claude/plugins/installed_plugins.json
 */
interface InstalledPluginsFile {
  version: number;
  plugins: Record<
    string,
    Array<{ scope: string; installPath: string; version: string }>
  >;
}

/**
 * A plugin keeps its manifest in `.claude-plugin/plugin.json`. Older installs put it at the
 * root, so both are looked at before a plugin is reported as having no readable manifest.
 */
async function readPluginJsonFile(
  pluginPath: string
): Promise<{ text: string; path: string } | undefined> {
  const candidates = [
    join(pluginPath, ".claude-plugin", "plugin.json"),
    join(pluginPath, "plugin.json"),
  ];
  for (const path of candidates) {
    try {
      return { text: await readFile(path, "utf-8"), path };
    } catch {
      continue;
    }
  }
  return undefined;
}

/**
 * Read plugin.json from a plugin's install directory.
 */
async function readPluginJson(
  pluginPath: string
): Promise<{ metadata: PluginMetadata; manifestPath: string } | null> {
  try {
    const file = await readPluginJsonFile(pluginPath);
    if (!file) return null;
    const content = JSON.parse(file.text);

    if (!content.name) {
      return null;
    }

    return {
      manifestPath: file.path,
      metadata: {
        name: content.name,
        version: content.version,
        description: content.description,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Parse the installed_plugins.json file to discover plugins.
 * Reads from ~/.claude/plugins/installed_plugins.json which lists all installed plugins
 * and their installation paths.
 */
async function readInstalledPluginsRegistry(
  home: string
): Promise<InstalledPluginsFile | null> {
  try {
    const path = join(home, ".claude", "plugins", "installed_plugins.json");
    const text = await readFile(path, "utf-8");
    return JSON.parse(text) as InstalledPluginsFile;
  } catch {
    return null;
  }
}

/**
 * Every installed plugin, from `~/.claude/plugins/installed_plugins.json`, keyed by
 * `plugin-name@marketplace-name`.
 *
 * Plugins are installed once and then enabled or disabled per scope through the
 * `enabledPlugins` setting, so the listing does not change with the selected scope — only
 * where a change to a plugin's state is written does.
 */
export async function readInstalledPlugins(
  home: string = homedir()
): Promise<Record<string, Plugin>> {
  const registry = await readInstalledPluginsRegistry(home);
  if (!registry?.plugins) return {};

  const plugins: Record<string, Plugin> = {};
  for (const [id, installations] of Object.entries(registry.plugins)) {
    const atIndex = id.lastIndexOf("@");
    if (atIndex <= 0) continue;

    const [installation] = installations;
    if (!installation) continue;

    plugins[id] = {
      id,
      name: id.slice(0, atIndex),
      marketplace: id.slice(atIndex + 1),
      path: installation.installPath,
      installedScope: installation.scope,
      ...manifestOf(await readPluginJson(installation.installPath)),
    };
  }
  return plugins;
}

/** A plugin whose manifest cannot be read is still installed, so it is still listed. */
function manifestOf(
  read: { metadata: PluginMetadata; manifestPath: string } | null
): { metadata: PluginMetadata | null; manifestPath?: string } {
  return read ? read : { metadata: null };
}
