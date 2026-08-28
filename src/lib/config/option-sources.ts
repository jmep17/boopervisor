import "server-only";

import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import type { OptionSource } from "@/lib/catalog";

/**
 * Option lists that only exist on the user's own machine, resolved when a control renders.
 * A source that is not there yields nothing, and the control falls back to the catalog's
 * suggestions and to free entry — an option list is a convenience, never a constraint.
 */
export async function resolveOptionSource(
  source: OptionSource,
  homeDir: string = homedir()
): Promise<string[]> {
  if (source === "outputStyles")
    return readNames(join(homeDir, ".claude", "output-styles"), ".md");
  // Claude Code keeps no local list of models, and custom themes arrive with plugins rather
  // than as files of their own. Both fall back to what the catalog suggests.
  return [];
}

/** The file names in a directory, without their extension. An absent directory yields nothing. */
async function readNames(
  directory: string,
  extension: string
): Promise<string[]> {
  try {
    return (await readdir(directory))
      .filter((file) => file.endsWith(extension))
      .map((file) => file.slice(0, -extension.length))
      .sort();
  } catch {
    return [];
  }
}
