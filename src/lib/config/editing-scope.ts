import type { Scope } from "@/lib/catalog";
import type { ScopeSelection } from "@/lib/scope/scope";

/** The `file` search parameter's values. Anything else reads as the project's own file. */
export type ProjectFile = "project" | "local";

export function parseProjectFile(
  value: string | string[] | undefined
): ProjectFile {
  return value === "local" ? "local" : "project";
}

/**
 * The scope an edit on /settings writes to. The user scope has one file; a project has two,
 * and the page's `file` parameter says which.
 */
export function editingScopeFor(
  selected: ScopeSelection,
  file: ProjectFile
): Scope {
  if (selected.kind !== "project") return "user";
  return file === "local" ? "local" : "project";
}
