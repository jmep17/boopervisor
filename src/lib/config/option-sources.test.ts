import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveOptionSource } from "./option-sources";

async function makeHome(): Promise<string> {
  return mkdtemp(join(tmpdir(), "boopervisor-options-"));
}

describe("resolveOptionSource", () => {
  test("offers the built-in output styles even with nothing on disk", async () => {
    expect(await resolveOptionSource("outputStyles", await makeHome())).toEqual(
      ["Default", "Proactive", "Concise", "Explanatory", "Learning"]
    );
  });

  test("names a custom style by its frontmatter, falling back to its file name", async () => {
    const home = await makeHome();
    const directory = join(home, ".claude", "output-styles");
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, "diagrams.md"),
      "---\nname: Diagrams first\ndescription: Lead with a diagram\n---\n"
    );
    await writeFile(join(directory, "terse.md"), "Say less.\n");

    const styles = await resolveOptionSource("outputStyles", home);
    expect(styles).toContain("Diagrams first");
    expect(styles).toContain("terse");
  });

  test("has nothing local to offer for models or themes", async () => {
    const home = await makeHome();
    expect(await resolveOptionSource("models", home)).toEqual([]);
    expect(await resolveOptionSource("themes", home)).toEqual([]);
  });
});
