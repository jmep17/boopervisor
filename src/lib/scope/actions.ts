"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { checkProjectDirectory } from "@/lib/config/projects";
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

const MESSAGES = {
  "not-absolute": "Enter an absolute path, starting with /.",
  missing: "No such directory.",
  "not-a-directory": "That path is a file, not a directory.",
} as const;

/**
 * Adds a directory that `~/.claude.json` does not list and selects it. The directory is
 * checked, not searched: nothing under it is enumerated.
 */
export async function addProjectScope(
  _previous: AddProjectState,
  formData: FormData
): Promise<AddProjectState> {
  const path = String(formData.get("path") ?? "").trim();
  if (!path) return { error: "Enter a directory path." };

  const check = await checkProjectDirectory(path);
  if (check !== "ok") return { error: MESSAGES[check] };

  const store = await cookies();
  const manual = parseManualProjects(store.get(MANUAL_PROJECTS_COOKIE)?.value);
  if (!manual.includes(path)) {
    store.set(
      MANUAL_PROJECTS_COOKIE,
      serializeManualProjects([...manual, path]),
      SCOPE_COOKIE_OPTIONS
    );
  }
  store.set(
    SCOPE_COOKIE,
    encodeScope({ kind: "project", path }),
    SCOPE_COOKIE_OPTIONS
  );
  revalidatePath("/", "layout");
  return {};
}
