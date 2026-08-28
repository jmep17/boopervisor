import { PRECEDENCE, type Scope } from "@/lib/catalog";
import type { FileState, JsonObject } from "./json-file";
import { getAtPath, hasAtPath } from "./paths";

/**
 * Resolving effective values, with no filesystem in sight, so the client bundle can hold
 * this while `settings.ts` — which reads files — stays on the server.
 */

/** How one settings file appeared when it was read. Reported, never swallowed. */
export interface FileStatus {
  scope: Scope;
  path: string;
  state: FileState;
}

/** What each readable settings file held, keyed by scope. */
export type ParsedSettings = Partial<Record<Scope, JsonObject>>;

export interface SettingsResolution {
  /** Every key present on disk in any scope, sorted. */
  effectiveValues: EffectiveValue[];
  fileStatuses: FileStatus[];
  parsed: ParsedSettings;
}

/** One key's effective value, the scope that won it, and what every scope contributed. */
export interface EffectiveValue {
  key: string;
  effectiveValue: unknown;
  winningScope: Scope;
  perScope: Partial<Record<Scope, unknown>>;
}

/** The effective value of one key, whether or not it is set anywhere. */
export function resolveKey(
  key: string,
  scopes: readonly Scope[],
  parsed: ParsedSettings
): EffectiveValue {
  const perScope: Partial<Record<Scope, unknown>> = {};
  let winningScope: Scope | undefined;
  for (const scope of scopes) {
    const content = parsed[scope];
    // A key like `permissions.allow` lives inside `permissions`, not at the top level.
    if (!content || !hasAtPath(content, key)) continue;
    perScope[scope] = getAtPath(content, key);
    // `scopes` is in precedence order, highest first, so the first hit wins.
    winningScope ??= scope;
  }
  return {
    key,
    effectiveValue: winningScope ? perScope[winningScope] : undefined,
    // An unset key is reported as coming from the lowest-precedence scope, which is where
    // Claude Code's own default applies.
    winningScope: winningScope ?? "user",
    perScope,
  };
}

/**
 * True when a higher-precedence scope already sets the key, so whatever is written to the
 * edited scope will not change the effective value. The interface says so before the write.
 */
export function isOverridden(
  effective: EffectiveValue,
  editing: Scope
): boolean {
  const winner = PRECEDENCE.indexOf(effective.winningScope);
  const edited = PRECEDENCE.indexOf(editing);
  return Object.keys(effective.perScope).length > 0 && winner < edited;
}
