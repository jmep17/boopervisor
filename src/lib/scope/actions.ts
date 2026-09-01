"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { checkProjectToAdd, withManualProject } from "./add-project";
import {
  decodeScope,
  encodeScope,
  parseManualProjects,
  serializeManualProjects,
} from "./scope";
import {
  MANUAL_PROJECTS_COOKIE,
  SCOPE_COOKIE,
  SCOPE_COOKIE_OPTIONS,
} from "./server";

/** Selects an existing scope. An unreadable value selects the user scope. */
export async function selectScope(encoded: string): Promise<void> {
  const store = await cookies();
  store.set(
    SCOPE_COOKIE,
    encodeScope(decodeScope(encoded)),
    SCOPE_COOKIE_OPTIONS
  );
  revalidatePath("/", "layout");
}

export type AddProjectState = { error?: string };

/**
 * Adds a directory that `~/.claude.json` does not list and selects it. The directory is
 * checked, not searched: nothing under it is enumerated.
 */
export async function addProjectScope(
  _previous: AddProjectState,
  formData: FormData
): Promise<AddProjectState> {
  const check = await checkProjectToAdd(String(formData.get("path") ?? ""));
  if (!check.ok) return { error: check.error };
  const { path } = check;

  const store = await cookies();
  const manual = parseManualProjects(store.get(MANUAL_PROJECTS_COOKIE)?.value);
  store.set(
    MANUAL_PROJECTS_COOKIE,
    serializeManualProjects(withManualProject(manual, path)),
    SCOPE_COOKIE_OPTIONS
  );
  store.set(
    SCOPE_COOKIE,
    encodeScope({ kind: "project", path }),
    SCOPE_COOKIE_OPTIONS
  );
  revalidatePath("/", "layout");
  return {};
}
