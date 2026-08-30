import { getSetting } from "@/lib/catalog";
import type { Scope } from "@/lib/catalog";

import {
  captureFileSnapshot,
  mutateJsonFile,
  type ExpectedFile,
  type MutationResult,
} from "./mutate";
import { settingFilePath, type SettingsLocation } from "./settings";
import { validateSetting } from "./validate";
import { deleteAtPath, setAtPath } from "./paths";
import type { FileSnapshot, JsonObject } from "./json-file";

/**
 * Writes one key into one scope's settings file. The validation happens here rather than
 * in the form, so no caller can reach the disk around it.
 *
 * `expected` is what the page read; a file that has changed since is refused as a stale write.
 */
export async function mutateSetting(options: {
  scope: Scope;
  location: SettingsLocation;
  key: string;
  /** `undefined` unsets the key, which is how a setting returns to Claude Code's default. */
  value: unknown;
  expected: ExpectedFile;
}): Promise<MutationResult> {
  const { scope, location, key, value, expected } = options;
  if (scope === "managed") {
    return {
      ok: false,
      problem: "invalid",
      message: "Managed settings are read-only.",
    };
  }

  // Unsetting is always allowed: it returns the key to Claude Code's own default.
  const definition = value === undefined ? undefined : getSetting(key);
  if (definition) {
    const validation = validateSetting(value, definition);
    if (!validation.ok)
      return { ok: false, problem: "invalid", message: validation.problem };
  }

  return mutateJsonFile({
    path: settingFilePath(scope, location),
    expected,
    target: { kind: "setting", scope, project: location.projectRoot, key },
    apply: (content) => applyKey(content, key, value),
    homeDir: location.homeDir,
  });
}

/** Unknown keys, and every other key's order, survive: only the one key is touched. */
function applyKey(
  content: JsonObject,
  key: string,
  value: unknown
): JsonObject {
  return value === undefined
    ? deleteAtPath(content, key)
    : setAtPath(content, key, value);
}

/** The snapshot a form must carry so the write can be stale-checked against what was read. */
export async function snapshotScope(
  scope: Scope,
  location: SettingsLocation
): Promise<FileSnapshot> {
  return captureFileSnapshot(settingFilePath(scope, location));
}
