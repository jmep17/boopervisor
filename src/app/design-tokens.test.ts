import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Repo root, from src/app. */
const ROOT = join(import.meta.dir, "..", "..");

const globalsCss = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");

/** Every colour the theme defines: "gray-100", "gray-alpha-400", "background-200", ... */
const DEFINED_COLOURS = new Set(
  [...globalsCss.matchAll(/--color-([a-z][a-z0-9-]*):/g)].map((m) => m[1])
);

const HUES = [
  // Geist
  "gray",
  "background",
  "blue",
  "red",
  "amber",
  "green",
  "teal",
  "purple",
  "pink",
  // Tailwind defaults that must never appear
  "zinc",
  "slate",
  "neutral",
  "stone",
  "sky",
  "indigo",
  "violet",
  "fuchsia",
  "rose",
  "orange",
  "yellow",
  "lime",
  "emerald",
  "cyan",
].join("|");

/** A colour utility with a numbered step, e.g. `bg-gray-50`, `hover:text-red-700`. */
const COLOUR_UTILITY = new RegExp(
  String.raw`\b(?:bg|text|border|outline|ring|fill|stroke|from|to|via|divide|placeholder|accent|caret|decoration|shadow)-((?:${HUES})(?:-alpha)?-\d+)\b`,
  "g"
);

/** Tailwind's default radius steps. Geist's are base/medium/large/fullscreen (+ full/none). */
const NON_GEIST_RADIUS =
  /\brounded-(?:[trbl]{1,2}-)?(?:xs|sm|md|lg|xl|2xl|3xl|4xl)\b/g;

function sourceFiles(): string[] {
  const glob = new Glob("src/**/*.tsx");
  return [...glob.scanSync({ cwd: ROOT })]
    .filter((file) => !file.endsWith(".test.tsx"))
    .sort();
}

describe("design tokens", () => {
  test("the theme defines the colours this test relies on", () => {
    // Guards the regex above against a rename in globals.css making the scan vacuous.
    expect(DEFINED_COLOURS.has("gray-1000")).toBe(true);
    expect(DEFINED_COLOURS.has("gray-alpha-400")).toBe(true);
    expect(DEFINED_COLOURS.has("background-200")).toBe(true);
    expect(DEFINED_COLOURS.has("gray-50")).toBe(false);
  });

  test("every colour class in the interface is a Geist token", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const source = readFileSync(join(ROOT, file), "utf8");
      for (const match of source.matchAll(COLOUR_UTILITY)) {
        if (!DEFINED_COLOURS.has(match[1]))
          offenders.push(`${file}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("every radius class in the interface is a Geist radius", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const source = readFileSync(join(ROOT, file), "utf8");
      for (const match of source.matchAll(NON_GEIST_RADIUS)) {
        offenders.push(`${file}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
