/**
 * The scope every page is read and written against: the user's own configuration, or one
 * project directory. Distinct from a settings `Scope` in the catalog, which names a
 * settings file. This module is pure so both the server and the browser can use it.
 */
export type ScopeSelection =
  { kind: "user" } | { kind: "project"; path: string };

export const USER_SCOPE: ScopeSelection = { kind: "user" };

/** Where a project in the switcher came from. Nothing is discovered by scanning. */
export type ProjectSource = "claude-json" | "manual";

export type ProjectOption = {
  path: string;
  label: string;
  source: ProjectSource;
};

/** Absolute paths only: a relative one would resolve against the server's working directory. */
export function isUsableProjectPath(path: string): boolean {
  return path.trim().length > 0 && path.startsWith("/");
}

/** The last segment of a directory path, which is how a project is named in the interface. */
export function projectLabel(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  const segment = trimmed.slice(trimmed.lastIndexOf("/") + 1);
  return segment || "/";
}

export function scopeLabel(scope: ScopeSelection): string {
  return scope.kind === "user" ? "User" : projectLabel(scope.path);
}

export function sameScope(a: ScopeSelection, b: ScopeSelection): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind === "user" || a.path === (b as { path: string }).path;
}

/**
 * The cookie form. A project path may itself contain a colon, so only the first one
 * separates the kind from the path.
 */
export function encodeScope(scope: ScopeSelection): string {
  return scope.kind === "user" ? "user" : `project:${scope.path}`;
}

/** Anything unrecognised reads as the user scope rather than failing a page render. */
export function decodeScope(value: string | undefined): ScopeSelection {
  if (!value) return USER_SCOPE;
  if (value === "user") return USER_SCOPE;
  const separator = value.indexOf(":");
  if (separator === -1 || value.slice(0, separator) !== "project")
    return USER_SCOPE;
  const path = value.slice(separator + 1);
  return isUsableProjectPath(path) ? { kind: "project", path } : USER_SCOPE;
}

/**
 * The switcher's project list: what `~/.claude.json` knows about, plus directories added
 * by hand. A path in both is listed once, as configured.
 */
export function mergeProjectPaths(
  fromClaudeJson: readonly string[],
  manual: readonly string[]
): ProjectOption[] {
  const byPath = new Map<string, ProjectOption>();
  const add = (path: string, source: ProjectSource) => {
    if (!isUsableProjectPath(path) || byPath.has(path)) return;
    byPath.set(path, { path, label: projectLabel(path), source });
  };
  for (const path of fromClaudeJson) add(path, "claude-json");
  for (const path of manual) add(path, "manual");
  return [...byPath.values()].sort(
    (a, b) => a.label.localeCompare(b.label) || a.path.localeCompare(b.path)
  );
}

/** What the switcher lists: the user scope first, then every known project. */
export type ScopeOption = {
  /** The encoded scope, which is also the select's value. */
  value: string;
  label: string;
  /** The directory, shown under the label so two projects named alike stay distinct. */
  detail?: string;
  source?: ProjectSource;
};

export function scopeOptions(
  projects: readonly ProjectOption[]
): ScopeOption[] {
  return [
    { value: encodeScope(USER_SCOPE), label: "User" },
    ...projects.map((project) => ({
      value: encodeScope({ kind: "project", path: project.path }),
      label: project.label,
      detail: project.path,
      source: project.source,
    })),
  ];
}

/** Manually added directories, as stored. Anything unreadable reads as none added. */
export function parseManualProjects(value: string | undefined): string[] {
  if (!value) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((entry): entry is string => typeof entry === "string");
}

export function serializeManualProjects(paths: readonly string[]): string {
  return JSON.stringify(paths);
}
