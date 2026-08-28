import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import type { OptionSource } from "@/lib/catalog";

// Server-side only: it reads the user's machine. A client component that imported it would
// pull `node:fs` into the browser bundle and fail the build, which is guard enough — the
// `server-only` package would say so more clearly but cannot be loaded by the test runner.

/** The styles Claude Code ships with, which are not files and so cannot be read from disk. */
const BUILT_IN_OUTPUT_STYLES = [
  "Default",
  "Proactive",
  "Concise",
  "Explanatory",
  "Learning",
];

/**
 * Option lists that only exist on the user's own machine, resolved when a control renders.
 * A source that is not there yields nothing, and the control falls back to the catalog's
 * suggestions and to free entry — an option list is a convenience, never a constraint.
 */
export async function resolveOptionSource(
  source: OptionSource,
  homeDir: string = homedir()
): Promise<string[]> {
  if (source === "outputStyles") {
    const custom = await readOutputStyles(
      join(homeDir, ".claude", "output-styles")
    );
    return [...BUILT_IN_OUTPUT_STYLES, ...custom];
  }
  // Claude Code keeps no local list of models, and custom themes arrive with plugins rather
  // than as files of their own. Both fall back to what the catalog suggests.
  return [];
}

/**
 * One Markdown file per style. A style is named by its file unless its frontmatter says
 * otherwise, and the name is what `outputStyle` is set to, so it is what is offered.
 */
async function readOutputStyles(directory: string): Promise<string[]> {
  let files: string[];
  try {
    files = (await readdir(directory)).filter((file) => file.endsWith(".md"));
  } catch {
    return [];
  }

  const names = await Promise.all(
    files.map((file) => styleName(directory, file))
  );
  return names.sort();
}

async function styleName(directory: string, file: string): Promise<string> {
  const fromFile = file.slice(0, -".md".length);
  try {
    const text = await readFile(join(directory, file), "utf8");
    return /^name:[ \t]*(.+?)[ \t]*$/m.exec(text)?.[1] ?? fromFile;
  } catch {
    return fromFile;
  }
}
