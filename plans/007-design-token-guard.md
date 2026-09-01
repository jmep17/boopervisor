# Plan 007: Every colour and radius class in the interface is a Geist token, and a test says so

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 69744da..HEAD -- src/components/history/history-row.tsx src/components/settings/controls/hooks-editor.tsx docs/design-system.md src/app/design-tokens.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW — three class-name substitutions and one new read-only test.
- **Depends on**: none
- **Category**: bug (visual) + tests
- **Planned at**: commit `69744da`, 2026-08-30

## Why this matters

Boopervisor's design system is Vercel's Geist, transcribed into Tailwind theme tokens in
`src/app/globals.css`. That file clears Tailwind's own palette (`--color-*: initial;`) so
that every colour utility is a Geist token "by construction". `docs/design-system.md:13`
claims a stray non-token class "fails to compile rather than quietly looking wrong".

That claim is false. Tailwind 4 generates CSS only for classes it can resolve; a class it
cannot resolve is silently dropped. The built stylesheet in `.next/static/chunks/*.css`
contains no `.bg-gray-50` rule, while `src/components/history/history-row.tsx` uses
`bg-gray-50` and `bg-red-50`. The History page's diff block therefore has no background at
all, and the error box in the Restore dialog is red text on white with no box. A fourth
site uses a Tailwind default radius (`rounded-sm`) instead of a Geist one.

After this plan: the three sites use tokens, the doc says what actually happens, and a
test scans every `.tsx` file and fails on any colour or radius class that the theme does
not define — so the "by construction" guarantee becomes true.

## Current state

- `src/app/globals.css` — the token layer. Colours are defined as `--ds-*` custom
  properties in `:root` (lines 16–133) and exposed to Tailwind inside `@theme inline`
  (line 149 onwards) as `--color-<hue>-<step>`. Only these hues exist: `black`, `white`,
  `background` (steps 100, 200), `gray`, `gray-alpha`, `blue`, `red`, `amber`, `green`,
  `teal`, `purple`, `pink` (steps 100–1000 in hundreds). Radii are `--radius-base`,
  `--radius-medium`, `--radius-large`, `--radius-fullscreen` (lines 258–261), so the
  valid radius utilities are `rounded-base`, `rounded-medium`, `rounded-large`,
  `rounded-fullscreen`, plus Tailwind's `rounded-full` and `rounded-none`, which are not
  colour-scale values and are used deliberately (`src/components/ui/switch.tsx`).

- `src/components/history/history-row.tsx:70` — the diff block:

```tsx
              <pre className="max-h-64 overflow-auto rounded-base bg-gray-50 p-3 text-xs font-mono text-gray-1000">
```

- `src/components/history/history-row.tsx:130` — the Restore dialog's error box:

```tsx
              <div className="rounded-base bg-red-50 p-3 text-sm text-red-700">
```

- `src/components/settings/controls/hooks-editor.tsx:120` — one hook entry's card:

```tsx
className = "flex flex-col gap-1 rounded-sm border border-gray-alpha-200 p-2";
```

- `docs/design-system.md:11-13`:

```markdown
- **Tokens.** `src/app/globals.css` holds Geist's colour, radius and shadow values,
  transcribed by hand, then exposes them as Tailwind theme values. Tailwind's own palette is
  cleared in the same `@theme` block, so every colour utility is a Geist token by
  construction and a stray `bg-zinc-50` fails to compile rather than quietly looking wrong.
```

- Existing precedent for a token-hygiene test — `src/components/ui/button.test.tsx:27-33`:

```tsx
test("dresses itself only in Geist tokens", () => {
  for (const variant of ["primary", "secondary", "ghost", "danger"] as const) {
    const className = buttonVariants({ variant });
    expect(className).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(className).not.toMatch(
      /\b(?:bg|text|border)-(?:zinc|slate|neutral|stone)-/
    );
  }
});
```

- Test conventions: `bun test`, tests colocated next to the code they test, `describe` /
  `test` from `bun:test`, sentence-style test names ("dresses itself only in Geist
  tokens"). `bunfig.toml` preloads `tests/register-dom.ts` and `tests/setup.ts` for every
  test file; that is harmless for a filesystem-only test.

- Geist step semantics, from the comment at `src/app/globals.css:8-10`: "100 default
  background, 200 hover, 300 active, 400 default border, 500 hover border, 600 active
  border, 700/800 high-contrast background, 900 secondary text, 1000 primary text." So a
  subtle surface behind code is `background-200` (the app already uses
  `bg-background-200` for `<pre>` blocks in `src/app/skills/skill-list.tsx:90`), and a
  tinted error surface is `red-100` with `red-900` text (the pattern `Badge` uses at
  `src/components/ui/badge.tsx:11-15`: `bg-red-200 text-red-900`).

## Commands you will need

| Purpose   | Command                                                 | Expected on success |
| --------- | ------------------------------------------------------- | ------------------- |
| Install   | `bun install`                                           | exit 0              |
| Typecheck | `bun run typecheck`                                     | exit 0, no errors   |
| Lint      | `bun run lint`                                          | exit 0              |
| Tests     | `bun test src/app/design-tokens.test.ts src/components` | all pass            |
| Format    | `bunx prettier --check <files you changed>`             | exit 0              |

Do not run the whole suite with a bare `bun test` unless plan 002 is marked DONE in
`plans/README.md`: before 002, some library tests write into the real `~/.claude`.

## Suggested executor toolkit

- `AGENTS.md` asks you to read the Next.js docs in `node_modules/next/dist/docs/` before
  writing code. Nothing in this plan touches Next-specific APIs; a skim of
  `01-app/01-getting-started/` is enough.
- Bun's file globbing: `new Glob("src/**/*.tsx").scanSync({ cwd })` from `import { Glob } from "bun"`.

## Scope

**In scope** (the only files you should modify):

- `src/components/history/history-row.tsx` — two class names on lines 70 and 130 only
- `src/components/settings/controls/hooks-editor.tsx` — one class name on line 120 only
- `docs/design-system.md` — the one sentence on line 13
- `src/app/design-tokens.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):

- `src/app/globals.css` — the token values are transcribed from Geist; nothing here
  changes them. Plan 009 edits this file; do not pre-empt it.
- Anything else in `hooks-editor.tsx` — plan 001 replaces that editor wholesale. You are
  changing one word so the new test passes; nothing more.
- `text-gray-700` / `text-gray-800` usages — those are a contrast problem handled by plan 009,
  not a missing-token problem. The test in this plan must _not_ flag them.
- `history-row.tsx:4` imports `node:path` inside a client component. Noted in
  `plans/README.md` as outside this plan; leave it.

## Git workflow

- Branch: `advisor/007-design-token-guard`
- One commit per step is fine; message style matches `git log` — a capitalised sentence,
  imperative, no prefix, e.g. `Build the app shell on Geist tokens`. Suggested final
  message: `Guard the interface against non-Geist colour and radius classes`.
- The pre-commit hook runs prettier on staged files; run `bunx prettier --write` on the
  files you touched before committing so the diff is what you reviewed.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the guard test (it must fail first)

Create `src/app/design-tokens.test.ts`:

```ts
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
```

**Verify**: `bun test src/app/design-tokens.test.ts` → 1 pass, 2 fail. The failure output
must list exactly these three offenders and no others:
`src/components/history/history-row.tsx: bg-gray-50`,
`src/components/history/history-row.tsx: bg-red-50`,
`src/components/settings/controls/hooks-editor.tsx: rounded-sm`.
If it lists anything else, STOP (see STOP conditions).

### Step 2: Replace the three classes

- `src/components/history/history-row.tsx:70`: `bg-gray-50` → `bg-background-200`.
- `src/components/history/history-row.tsx:130`: `bg-red-50` → `bg-red-100` and, on the
  same line, `text-red-700` → `text-red-900` (the token comment says 900 is text; `Badge`
  already pairs a 100/200 background with 900 text).
- `src/components/settings/controls/hooks-editor.tsx:120`: `rounded-sm` → `rounded-base`.

**Verify**: `bun test src/app/design-tokens.test.ts` → 3 pass, 0 fail.
**Verify**: `grep -n "bg-gray-50\|bg-red-50\|rounded-sm" src/components/history/history-row.tsx src/components/settings/controls/hooks-editor.tsx` → no output.

### Step 3: Correct the design-system doc

In `docs/design-system.md`, replace the sentence on line 13 so the bullet reads:

```markdown
- **Tokens.** `src/app/globals.css` holds Geist's colour, radius and shadow values,
  transcribed by hand, then exposes them as Tailwind theme values. Tailwind's own palette is
  cleared in the same `@theme` block, so every colour utility is a Geist token by
  construction. Tailwind drops a class it cannot resolve silently rather than failing, so
  `src/app/design-tokens.test.ts` scans every component for a colour or radius class the
  theme does not define.
```

**Verify**: `grep -c "design-tokens.test.ts" docs/design-system.md` → `1`.
**Verify**: `grep -c "fails to compile" docs/design-system.md` → `0`.

### Step 4: Full gate

**Verify**: `bun run typecheck` → exit 0.
**Verify**: `bun run lint` → exit 0.
**Verify**: `bun test src/app/design-tokens.test.ts src/components` → all pass (88 existing + 3 new = 91).
**Verify**: `bunx prettier --check src/app/design-tokens.test.ts src/components/history/history-row.tsx src/components/settings/controls/hooks-editor.tsx docs/design-system.md` → exit 0 (run `--write` first if not).

## Test plan

- New: `src/app/design-tokens.test.ts` with the three tests in Step 1. It is a
  filesystem scan, not a render test, and reads only files inside the repository.
- Pattern: `src/components/ui/button.test.tsx` "dresses itself only in Geist tokens" — the
  same idea, widened from one component to every component.
- No existing test changes.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun test src/app/design-tokens.test.ts` → 3 pass, 0 fail
- [ ] `bun test src/components` → 0 fail
- [ ] `grep -rn "bg-gray-50\|bg-red-50\|rounded-sm" src --include="*.tsx" | grep -v "\.test\.tsx"` → no output
- [ ] `grep -c "fails to compile" docs/design-system.md` → `0`
- [ ] `git status --short` shows only the four in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The Step 1 failure lists an offender other than the three named. That means another
  plan (001, 008, 009, 010, 011) landed something non-token, or the regex is catching a
  false positive; either way the reviewer decides, not you.
- `hooks-editor.tsx` no longer contains `rounded-sm` at all (plan 001 has replaced the
  editor). Skip the hooks-editor edit, note it in your report, and continue.
- The `--color-*` lines in `globals.css` have been renamed so `DEFINED_COLOURS` is empty
  (Step 1's first test fails). Do not loosen the regex.
- Prettier reformats lines you did not touch in `history-row.tsx` or `hooks-editor.tsx`
  in a way that makes the diff hard to review — stage only your lines and report the rest.

## Maintenance notes

- The scan knows the Tailwind property prefixes it lists (`bg`, `text`, `border`, …). A
  new prefix (`inset-ring-*`, say) would need adding to `COLOUR_UTILITY`.
- Arbitrary values (`bg-[#fff]`) are not caught here; `button.test.tsx` catches hex
  literals for the button only. If someone reaches for a hex literal in a component, the
  answer is a new `--ds-*` token in `globals.css`, not a wider exemption.
- Plan 009 extends this test with a contrast rule (bare `text-gray-700`/`text-gray-800`).
  Keep the file's structure (a `sourceFiles()` helper and one `test` per rule) so that
  extension is one more `test` block.
- Reviewer: check the three replacements render as intended — dark mode included, since
  every token is a `light-dark()` pair and `background-200` is `#000` in dark, the same as
  `background-100`. If the diff block needs to stand out in dark mode, `bg-gray-100` is the
  next step up and is also a token; that choice is the reviewer's, not the executor's.
