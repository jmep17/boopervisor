import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { OUTPUTS, refusal, trimSlashes } from "./skill-output-guard";

const cwd = "/repo";

describe("refusal", () => {
  test("refuses a write into a retired default and names the replacement", () => {
    const message = refusal("plans/019-x.md", cwd, {
      ADVISOR_PLANS_DIR: "docs/plans",
    });
    expect(message).toContain("`docs/plans/`");
    expect(message).toContain("ADVISOR_PLANS_DIR");
  });

  test("allows the configured directory", () => {
    expect(
      refusal("docs/plans/019-x.md", cwd, { ADVISOR_PLANS_DIR: "docs/plans" })
    ).toBeNull();
  });

  test("does not police an output that is not overridden", () => {
    expect(refusal("plans/x.md", cwd, {})).toBeNull();
    expect(
      refusal("plans/x.md", cwd, { ADVISOR_PLANS_DIR: "plans/" })
    ).toBeNull();
  });

  test("normalises an absolute path inside the repo", () => {
    expect(
      refusal("/repo/plans/x.md", cwd, { ADVISOR_PLANS_DIR: "docs/plans" })
    ).not.toBeNull();
  });

  test("treats a backslash-separated path like a slash-separated one", () => {
    // What `relative` returns on Windows; the guard must not depend on the host separator.
    expect(
      refusal("plans\\x.md", cwd, { ADVISOR_PLANS_DIR: "docs/plans" })
    ).not.toBeNull();
  });

  test("ignores a path outside the repo", () => {
    expect(
      refusal("/elsewhere/plans/x.md", cwd, { ADVISOR_PLANS_DIR: "docs/plans" })
    ).toBeNull();
  });
});

describe("the declared locations", () => {
  // CLAUDE.md is what the models read; the project scope's env block is what hooks and
  // plugins read. The two must say the same thing, and the table is the place to edit.
  // Only the *_DIR keys are compared, so an unrelated env value added later is ignored.
  const settings = JSON.parse(
    readFileSync(new URL("../.claude/settings.json", import.meta.url), "utf8")
  ) as { env: Record<string, string> };
  const declared = Object.fromEntries(
    Object.entries(settings.env)
      .filter(([key]) => key.endsWith("_DIR"))
      .map(([key, value]) => [key, trimSlashes(value)])
  );
  const claudeMd = readFileSync(
    new URL("../CLAUDE.md", import.meta.url),
    "utf8"
  );
  const rows = claudeMd
    .split("\n")
    .filter((line) => /^\|.*`[A-Z_]+_DIR`/.test(line))
    .map((line) => {
      const cells = line
        .split("|")
        .map((cell) => cell.trim().replace(/`/g, ""));
      return { variable: cells[2], directory: trimSlashes(cells[3]) };
    });

  test("CLAUDE.md's table and .claude/settings.json's env agree", () => {
    expect(rows.length).toBe(Object.keys(declared).length);
    for (const row of rows) {
      expect(declared[row.variable]).toBe(row.directory);
    }
  });

  test("every guarded output has a row in CLAUDE.md", () => {
    const variables = rows.map((row) => row.variable);
    for (const output of OUTPUTS) {
      expect(variables).toContain(output.variable);
    }
  });

  test("no row reuses a directory another row has retired", () => {
    // If advisor plans move to docs/plans and plan pages then move into plans/, the guard
    // would refuse every plan-page write. Reject that configuration here, not at write time.
    const inUse = new Set(Object.values(declared));
    for (const output of OUTPUTS) {
      const own = declared[output.variable];
      if (own === undefined || own === output.assumed) continue;
      expect(inUse.has(output.assumed)).toBe(false);
    }
  });
});
