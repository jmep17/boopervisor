import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { getSetting, PRECEDENCE, SCOPE_FILES, type Scope } from "@/lib/catalog";
import { parseJsonObject, type FileState, type JsonObject } from "./json-file";
import { settingPaths } from "./paths";
import {
  resolveKey,
  type FileStatus,
  type ParsedSettings,
  type SettingsResolution,
} from "./effective";

export type { FileState } from "./json-file";
export * from "./effective";

/**
 * Where the settings files are, for one selection. Reading and writing both resolve paths
 * through this, so a mutation can never target a file the page did not read.
 *
 * `homeDir` and `managedPath` exist so the whole module can be tested against a temporary
 * directory: nothing here reads a real machine's configuration unless it is asked to.
 */
export interface SettingsLocation {
  /** Absent for the user scope, in which case the project files are not read at all. */
  projectRoot?: string;
  homeDir?: string;
  managedPath?: string;
}

/**
 * Managed settings live outside both the home directory and the project: they belong to
 * whoever administers the machine, which is why the interface only ever reads them.
 */
export function managedSettingsPath(
  platform: NodeJS.Platform = process.platform
): string {
  if (platform === "darwin")
    return "/Library/Application Support/ClaudeCode/managed-settings.json";
  if (platform === "win32")
    return "C:\\Program Files\\ClaudeCode\\managed-settings.json";
  return "/etc/claude-code/managed-settings.json";
}

/** `globalConfig` is `~/.claude.json`: not a settings file, and never part of the merge. */
export function settingFilePath(
  scope: Scope,
  location: SettingsLocation = {}
): string {
  if (scope === "user")
    return join(location.homeDir ?? homedir(), ".claude", "settings.json");
  if (scope === "managed") return location.managedPath ?? managedSettingsPath();
  if (scope === "globalConfig") {
    throw new Error(
      "~/.claude.json is not a settings file and is not part of the settings merge."
    );
  }
  if (!location.projectRoot)
    throw new Error(`The ${scope} scope needs a project directory.`);
  return join(location.projectRoot, SCOPE_FILES[scope]);
}

/** The scopes a selection reads: the user scope alone, or the user scope plus a project's. */
export function scopesFor(location: SettingsLocation): Scope[] {
  return PRECEDENCE.filter(
    (scope) =>
      location.projectRoot || (scope !== "project" && scope !== "local")
  );
}

/**
 * A key the catalog describes as settable in its own right. A container such as
 * `permissions` is described but not settable, so a file's `permissions` is walked into
 * rather than reported as one key.
 */
function isSettable(key: string): boolean {
  const setting = getSetting(key);
  return Boolean(setting && !setting.virtual);
}

/** Missing, empty and malformed all read as no settings, with the state saying which. */
export async function readSettingsFile(
  path: string
): Promise<{ content: JsonObject; state: FileState }> {
  try {
    return parseJsonObject(await readFile(path, "utf8"));
  } catch {
    return { content: {}, state: "missing" };
  }
}

export async function readScopeSettings(
  scope: Scope,
  location: SettingsLocation = {}
): Promise<JsonObject> {
  return (await readSettingsFile(settingFilePath(scope, location))).content;
}

/**
 * Reads every settings file that applies and resolves each key by precedence: managed over
 * project-local over project over user.
 */
export async function resolveEffectiveSettings(
  location: SettingsLocation = {}
): Promise<SettingsResolution> {
  const scopes = scopesFor(location);
  const fileStatuses: FileStatus[] = [];
  const parsed: ParsedSettings = {};

  for (const scope of scopes) {
    const path = settingFilePath(scope, location);
    const { content, state } = await readSettingsFile(path);
    fileStatuses.push({ scope, path, state });
    if (state === "ok") parsed[scope] = content;
  }

  const keys = new Set<string>();
  for (const scope of scopes) {
    for (const key of settingPaths(parsed[scope] ?? {}, isSettable)) {
      keys.add(key);
    }
  }

  const effectiveValues = [...keys]
    .sort()
    .map((key) => resolveKey(key, scopes, parsed));
  return { effectiveValues, fileStatuses, parsed };
}
