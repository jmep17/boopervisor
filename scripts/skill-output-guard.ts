import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

/**
 * A skill output whose default directory this repo may have retired. `variable` is the
 * environment variable, set in the project scope's `.claude/settings.json` `env` block,
 * that names the directory actually in use; `assumed` is the directory the skill's own
 * instructions hardcode. An output with no hardcoded default (research notes) has nothing
 * to refuse, so it is declared in CLAUDE.md only.
 */
export const OUTPUTS = [
  { variable: "ADVISOR_PLANS_DIR", label: "Advisor plans", assumed: "plans" },
  { variable: "ISSUES_DIR", label: "Issues and specs", assumed: ".scratch" },
  { variable: "ADR_DIR", label: "ADRs", assumed: "docs/adr" },
  { variable: "PLANS_DIR", label: "Plan pages", assumed: "artifacts/plans" },
  {
    variable: "DIAGRAMS_DIR",
    label: "Diagrams",
    assumed: "artifacts/diagrams",
  },
  {
    variable: "DECISIONS_DIR",
    label: "Decision pages",
    assumed: "artifacts/decisions",
  },
] as const;

/** `./plans/` and `plans` name the same directory; compare them in one spelling. */
export function trimSlashes(directory: string): string {
  return directory.replace(/^\.\//, "").replace(/\/+$/, "");
}

/**
 * The message to refuse a write with, or null to let it through. A write is refused only
 * when it targets a default directory this repo has moved elsewhere; an output whose
 * variable is unset, or equal to its default, is not policed at all, and a path outside
 * the repo is none of this guard's business. Separators are compared as `/` so the same
 * check holds on Windows, where `relative` returns backslashes.
 */
export function refusal(
  filePath: string,
  cwd: string,
  env: Record<string, string | undefined>
): string | null {
  const target = relative(
    cwd,
    isAbsolute(filePath) ? filePath : resolve(cwd, filePath)
  ).replace(/\\/g, "/");
  if (target.startsWith("..") || isAbsolute(target)) return null;
  for (const output of OUTPUTS) {
    const configured = env[output.variable];
    if (!configured || trimSlashes(configured) === output.assumed) continue;
    if (target === output.assumed || target.startsWith(`${output.assumed}/`)) {
      return (
        `\`${output.assumed}/\` is retired in this repo. ${output.label} live in ` +
        `\`${trimSlashes(configured)}/\` (${output.variable}). Write the file there instead.`
      );
    }
  }
  return null;
}

// Claude Code runs this as a PreToolUse hook for Write and Edit: the tool call arrives as
// JSON on stdin; exit 2 blocks it and shows stderr to the model; exit 0 lets it through.
if (import.meta.main) {
  const input = JSON.parse(readFileSync(0, "utf8")) as {
    cwd?: string;
    tool_input?: { file_path?: unknown };
  };
  const filePath = input.tool_input?.file_path;
  if (typeof filePath === "string") {
    const message = refusal(filePath, input.cwd ?? process.cwd(), process.env);
    if (message) {
      console.error(message);
      process.exit(2);
    }
  }
}
