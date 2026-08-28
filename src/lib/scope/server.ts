import { cookies } from "next/headers";

import { claudeJsonPath, readProjectPaths } from "@/lib/config/projects";
import {
  decodeScope,
  mergeProjectPaths,
  parseManualProjects,
  type ProjectOption,
  type ScopeSelection,
} from "./scope";

/**
 * The selection lives in a cookie so it survives navigation and reload without a store,
 * and so every page and Server Action reads it the same way.
 */
export const SCOPE_COOKIE = "boopervisor.scope";
export const MANUAL_PROJECTS_COOKIE = "boopervisor.projects";

const YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export const SCOPE_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  maxAge: YEAR_IN_SECONDS,
} as const;

/** The scope every page is read and written against. */
export async function getSelectedScope(): Promise<ScopeSelection> {
  const store = await cookies();
  return decodeScope(store.get(SCOPE_COOKIE)?.value);
}

export async function getManualProjectPaths(): Promise<string[]> {
  const store = await cookies();
  return parseManualProjects(store.get(MANUAL_PROJECTS_COOKIE)?.value);
}

/**
 * Everything the switcher renders. Projects come from the `projects` map in
 * `~/.claude.json` plus directories added by hand; no directory is ever enumerated.
 */
export async function getScopeState(): Promise<{
  selected: ScopeSelection;
  projects: ProjectOption[];
}> {
  const [selected, manual, configured] = await Promise.all([
    getSelectedScope(),
    getManualProjectPaths(),
    readProjectPaths(claudeJsonPath()),
  ]);
  return { selected, projects: mergeProjectPaths(configured, manual) };
}
