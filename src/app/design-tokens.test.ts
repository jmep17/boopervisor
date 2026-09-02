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

/**
 * Source split into lines twice: as written, and with comments blanked out
 * (block comments become the same number of empty lines, so indices match).
 * Copy rules check the stripped line; the allow marker is read from the original.
 */
function copyLines(source: string): {
  original: string[];
  stripped: string[];
} {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  return { original: source.split("\n"), stripped: stripped.split("\n") };
}

const ALLOW_MARKER = "design-tokens-allow";

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

  /**
   * Geist's gray-700/800 are "high-contrast background" steps (globals.css:10); gray-800 on
   * white is 4.1:1, under WCAG AA's 4.5:1. Text is gray-900 or darker. A variant-prefixed
   * use (`disabled:`, `placeholder:`, `data-[placeholder]:`) is exempt: placeholder and
   * disabled text may be lighter.
   */
  const LOW_CONTRAST_TEXT = /(?<![:\w-])text-gray-(?:700|800)\b/g;

  test("readable text is never gray-700 or gray-800", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const source = readFileSync(join(ROOT, file), "utf8");
      for (const match of source.matchAll(LOW_CONTRAST_TEXT)) {
        offenders.push(`${file}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("DESIGN.md rules", () => {
  test("interface copy has no em dashes", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const source = readFileSync(join(ROOT, file), "utf8");
      const { original, stripped } = copyLines(source);
      stripped.forEach((line, i) => {
        if (original[i].includes(ALLOW_MARKER)) return;
        if (line.includes("—"))
          offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  test("an ellipsis is the character, not three dots", () => {
    const offenders: string[] = [];
    const THREE_DOTS = /[A-Za-z]\.\.\./;
    for (const file of sourceFiles()) {
      const source = readFileSync(join(ROOT, file), "utf8");
      const { stripped } = copyLines(source);
      stripped.forEach((line, i) => {
        if (THREE_DOTS.test(line))
          offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  test("no all-caps eyebrows or tracked labels", () => {
    const offenders: string[] = [];
    const EYEBROW = /\b(?:uppercase|tracking-(?:wide|wider|widest))\b/;
    for (const file of sourceFiles()) {
      const source = readFileSync(join(ROOT, file), "utf8");
      const { stripped } = copyLines(source);
      stripped.forEach((line, i) => {
        if (EYEBROW.test(line))
          offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  test("font sizes are the type roles or body sizes", () => {
    const offenders: string[] = [];
    const ARBITRARY_SIZE = /\btext-(?:xs|lg|xl|2xl|3xl|4xl|5xl)\b/g;
    for (const file of sourceFiles()) {
      if (file === "src/components/ui/badge.tsx") continue;
      const source = readFileSync(join(ROOT, file), "utf8");
      for (const match of source.matchAll(ARBITRARY_SIZE)) {
        offenders.push(`${file}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("no decorative effects", () => {
    const offenders: string[] = [];
    const DECORATIVE =
      /\b(?:bg-gradient-|backdrop-blur|blur-|animate-(?!none\b)|shadow-\[)/;
    for (const file of sourceFiles()) {
      const source = readFileSync(join(ROOT, file), "utf8");
      const { stripped } = copyLines(source);
      stripped.forEach((line, i) => {
        if (DECORATIVE.test(line))
          offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  test("no arbitrary type values", () => {
    const offenders: string[] = [];
    const ARBITRARY_TYPE = /\b(?:text|leading|font|tracking)-\[/;
    for (const file of sourceFiles()) {
      const source = readFileSync(join(ROOT, file), "utf8");
      const { stripped } = copyLines(source);
      stripped.forEach((line, i) => {
        if (ARBITRARY_TYPE.test(line))
          offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  test("motion is colour transitions only", () => {
    const offenders: string[] = [];
    const OTHER_TRANSITION = /\btransition-(?!colors\b)[a-z]+/;
    for (const file of sourceFiles()) {
      if (file === "src/components/ui/switch.tsx") continue; // the thumb slides
      const source = readFileSync(join(ROOT, file), "utf8");
      const { stripped } = copyLines(source);
      stripped.forEach((line, i) => {
        if (OTHER_TRANSITION.test(line))
          offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
