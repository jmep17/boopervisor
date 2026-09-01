# Plan 009: Text scales with the reader's font size, and every sentence is legible

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 69744da..HEAD -- src/app/globals.css src/app/design-tokens.test.ts src/components src/app/skills/skill-list.tsx src/app/mcp/mcp-server-list.tsx src/app/plugins/plugin-list.tsx`
> Plans 007 and 008 are expected to have changed some of these files first (see
> "Depends on"). For any other change, compare the "Current state" excerpts against the
> live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M — three token values, a class-name sweep over ~30 sites, one test rule.
- **Risk**: LOW — no behaviour changes; at the browser's default 16px root the rem
  control heights render at the same pixel sizes as today.
- **Depends on**: plans/007-design-token-guard.md (this plan adds a rule to its test);
  plans/008-setting-row-overflow.md (touches the same lines in `setting-row.tsx`; run 008
  first so this plan's sweep is applied to the final layout).
- **Category**: a11y / tech-debt
- **Planned at**: commit `69744da`, 2026-08-30

## Why this matters

Three things stop the interface from reading well or scaling with the reader:

1. **Control heights are pixels.** `--spacing-control-sm/md/lg` are `32px/40px/48px`.
   Every font size in the app is rem-based (Tailwind's `text-sm` is `0.875rem`), so when a
   reader raises their browser font size — Chrome's "Very large", Safari's minimum font
   size, an OS accessibility setting — the text grows and the buttons, inputs and select
   triggers do not. A `size="sm"` button (32px) holding text at 150% clips its label.
2. **12px is the default size for prose.** `text-xs` (0.75rem = 12px) appears 36 times
   across the components and `text-sm` 32 times. Descriptions, help text, the per-scope
   breakdown, locked-state reasons and _error messages_ are all 12px. Reading a
   settings page is reading small print.
3. **`text-gray-800` fails contrast.** Geist's gray-800 is `#7d7d7d`; on white that is a
   4.1:1 contrast ratio, below WCAG AA's 4.5:1 for normal text. The repo's own token
   comment (`src/app/globals.css:10`) says 700/800 are "high-contrast background" and 900
   is "secondary text" — so these five uses are also against the design system's stated
   semantics. (In dark mode gray-800 on black is 5.1:1 and passes; light mode is the
   default and fails.)

After this plan: control heights are rem and grow with the text; `text-xs` is reserved
for badges and one-line monospaced metadata; everything a person reads is `text-sm` or
larger; `text-gray-800`/`text-gray-700` never colour readable text; and a test rule holds
the last point.

## Current state

### Token layer — `src/app/globals.css`

Line 10 (the semantics comment):

```css
 * 700/800 high-contrast background, 900 secondary text, 1000 primary text.
```

Lines 280–283:

```css
/* Geist control heights, smallest to largest. */
--spacing-control-sm: 32px;
--spacing-control-md: 40px;
--spacing-control-lg: 48px;
```

These are used as `h-control-sm|md|lg` in `src/components/ui/button.tsx:25-27`,
`src/components/ui/input.tsx:14`, `src/components/ui/select.tsx:47`. Radii
(`--radius-*`, lines 258–261) and shadows are also px and **stay px**: Geist's corners do
not scale with text.

### The guard test — `src/app/design-tokens.test.ts` (created by plan 007)

Has a `sourceFiles()` helper returning every non-test `src/**/*.tsx` path relative to
the repo root, and one `test(...)` block per rule inside `describe("design tokens")`.
This plan adds one more block; if the file does not exist, STOP (plan 007 has not run).

### Where `text-gray-800` and `text-gray-700` colour text

```
src/app/plugins/plugin-list.tsx:70              <p className="text-xs text-gray-800">{plugin.plugin.marketplace}</p>
src/components/settings/settings-list.tsx:77    <span className="ml-2 font-mono text-gray-800">   (after plan 008: "ml-2 break-all font-mono text-gray-800")
src/components/settings/controls/hooks-editor.tsx:170   <p className="mt-1 text-xs text-gray-800">
src/components/settings/controls/hooks-editor.tsx:196   <p className="text-xs text-gray-800">
src/components/items/master-detail.tsx:75       <span className="truncate text-xs text-gray-800">
```

`text-gray-700` appears only behind a variant prefix, which is fine and must keep
working: `disabled:text-gray-700` (`button.tsx:12`), `data-[placeholder]:text-gray-700`
and `data-[disabled]:text-gray-700` (`select.tsx:48,90`), `placeholder:text-gray-700`
(`control.ts` — a `.ts` file, outside the scan).

### Every `text-xs` site, with its decision

Locate by content, not line number — plan 008 will have moved some lines. **Keep** means
leave `text-xs`; **→ sm** means change `text-xs` to `text-sm` on that element.

**Badges and one-line monospaced metadata — keep `text-xs`:**

| File                                        | Element                                                               | Decision                            |
| ------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------- |
| `src/components/ui/badge.tsx:7`             | the badge base class                                                  | keep                                |
| `src/components/scope-switcher.tsx:67`      | `font-mono text-xs text-gray-900` project path inside a dropdown item | keep                                |
| `src/components/items/master-detail.tsx:75` | `truncate text-xs text-gray-800` detail line under an item label      | keep size; colour → `text-gray-900` |
| `src/app/skills/skill-list.tsx:72`          | `font-mono text-xs text-gray-900` path under the h2                   | keep                                |
| `src/app/mcp/mcp-server-list.tsx:75`        | `font-mono text-xs text-gray-900` path under the h2                   | keep                                |
| `src/app/plugins/plugin-list.tsx:71`        | `font-mono text-xs text-gray-900` manifest path under the h2          | keep                                |

**Sentences, headings, code blocks, errors — → `text-sm`:**

| File                                                       | Element                                                                                                         | Decision                       |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `src/app/plugins/plugin-list.tsx:70`                       | `<p className="text-xs text-gray-800">` marketplace                                                             | → sm; colour → `text-gray-900` |
| `src/app/plugins/plugin-list.tsx:89`                       | `<h3 className="text-xs font-medium …">Metadata</h3>`                                                           | → sm                           |
| `src/app/plugins/plugin-list.tsx:90`                       | `<pre … text-xs …>`                                                                                             | → sm                           |
| `src/app/plugins/plugin-list.tsx:95`                       | `<p className="text-xs text-gray-900">` help text                                                               | → sm                           |
| `src/app/skills/skill-list.tsx:89`                         | `<h3>Metadata</h3>`                                                                                             | → sm                           |
| `src/app/skills/skill-list.tsx:90`                         | `<pre>`                                                                                                         | → sm                           |
| `src/app/skills/skill-list.tsx:93`                         | help text                                                                                                       | → sm                           |
| `src/app/mcp/mcp-server-list.tsx:93`                       | `<h3>Configuration</h3>`                                                                                        | → sm                           |
| `src/app/mcp/mcp-server-list.tsx:96`                       | `<pre>`                                                                                                         | → sm                           |
| `src/app/mcp/mcp-server-list.tsx:99`                       | help text                                                                                                       | → sm                           |
| `src/components/settings/settings-list.tsx:69`             | `<ul className="flex flex-col gap-1 text-xs">` files list                                                       | → sm                           |
| `src/components/settings/settings-list.tsx:112`            | `<p className="max-w-prose text-xs text-gray-900">` uncatalogued note                                           | → sm                           |
| `src/components/settings/setting-row.tsx`                  | the two `text-xs text-gray-900` summary descriptions (`definition.summary` and "Not described by the catalog…") | → sm                           |
| `src/components/settings/setting-row.tsx`                  | `font-mono text-xs text-gray-900` effective value in the summary (after 008: also `min-w-0 truncate`)           | → sm                           |
| `src/components/settings/setting-row.tsx`                  | `<dl className="flex flex-col gap-1 text-xs">`                                                                  | → sm                           |
| `src/components/settings/setting-row.tsx`                  | `<p className="text-xs text-gray-900">Managed settings belong…`                                                 | → sm                           |
| `src/components/settings/controls/json.tsx:34`             | `<p role="alert" className="text-xs text-red-900">`                                                             | → sm                           |
| `src/components/settings/controls/permission-rules.tsx:92` | `<p className="text-xs text-red-900">` rule error                                                               | → sm                           |
| `src/components/settings/controls/hooks-editor.tsx:122`    | `<div className="flex flex-col gap-2 text-xs">` wrapping Matcher/Command labels                                 | → sm                           |
| `src/components/settings/controls/hooks-editor.tsx:170`    | `<p className="mt-1 text-xs text-gray-800">`                                                                    | → sm; colour → `text-gray-900` |
| `src/components/settings/controls/hooks-editor.tsx:188`    | `<p className="text-xs text-red-900">` entry error                                                              | → sm                           |
| `src/components/settings/controls/hooks-editor.tsx:196`    | `<p className="text-xs text-gray-800">No hooks configured…`                                                     | → sm; colour → `text-gray-900` |
| `src/components/items/item-state-controls.tsx:65`          | `<p className="text-xs text-gray-900">{lockedReason}</p>`                                                       | → sm                           |
| `src/components/items/item-state-controls.tsx:68`          | `<p role="alert" className="text-xs text-red-900">`                                                             | → sm                           |
| `src/components/items/master-detail.tsx:90`                | "Show archived" link `px-3 text-xs text-gray-900`                                                               | → sm                           |
| `src/components/history/history-row.tsx:56`                | `<span className="text-xs text-gray-900">` path + time                                                          | → sm                           |
| `src/components/history/history-row.tsx:69`                | `<p className="text-xs font-medium text-gray-900">Changes:</p>`                                                 | → sm                           |
| `src/components/history/history-row.tsx:70`                | `<pre … text-xs …>` diff                                                                                        | → sm                           |
| `src/components/history/history-row.tsx:106`               | "This backup file was pruned…"                                                                                  | → sm                           |

That is 30 sites to change (6 kept). The rule for anything not in the table (a site a
later plan added): `text-xs` only for a `Badge` or a single line of monospaced metadata
directly beneath a heading; everything else `text-sm`.

### Conventions

Tailwind 4.3; Geist tokens only (plan 007's test enforces it). Test conventions: `bun test`,
colocated tests, sentence-style names. Prettier runs on commit.

## Commands you will need

| Purpose    | Command                                                 | Expected on success |
| ---------- | ------------------------------------------------------- | ------------------- |
| Install    | `bun install`                                           | exit 0              |
| Typecheck  | `bun run typecheck`                                     | exit 0              |
| Lint       | `bun run lint`                                          | exit 0              |
| Tests      | `bun test src/app/design-tokens.test.ts src/components` | all pass            |
| Format     | `bunx prettier --check <files you changed>`             | exit 0              |
| Dev server | `bun dev` → http://localhost:3000                       | renders             |

Do not run a bare `bun test` unless plan 002 is DONE in `plans/README.md`.

## Suggested executor toolkit

- `AGENTS.md`: read `node_modules/next/dist/docs/` before writing code. This plan touches
  no Next API.
- Tailwind 4 theme: a `--spacing-<name>` variable under `@theme` is what makes `h-<name>`
  work; changing its value from px to rem needs no other change.

## Scope

**In scope** (the only files you should modify):

- `src/app/globals.css` — lines 281–283 only
- `src/app/design-tokens.test.ts` — add one `test` block
- Every file in the two tables above, class names on the listed elements only:
  `src/app/plugins/plugin-list.tsx`, `src/app/skills/skill-list.tsx`,
  `src/app/mcp/mcp-server-list.tsx`, `src/components/settings/settings-list.tsx`,
  `src/components/settings/setting-row.tsx`, `src/components/settings/controls/json.tsx`,
  `src/components/settings/controls/permission-rules.tsx`,
  `src/components/settings/controls/hooks-editor.tsx`,
  `src/components/items/item-state-controls.tsx`, `src/components/items/master-detail.tsx`,
  `src/components/history/history-row.tsx`

**Out of scope** (do NOT touch, even though they look related):

- `--radius-*` and `--ds-shadow-*` values — px by design.
- `src/components/ui/badge.tsx` — badges stay `text-xs`.
- `src/components/ui/control.ts` `placeholder:text-gray-700` and the variant-prefixed
  `text-gray-700` in `button.tsx` / `select.tsx` — placeholder and disabled text are
  allowed to be lighter; the new test rule exempts prefixed uses on purpose.
- `text-2xl` / `text-base` sites — fine as they are.
- Layout classes (`flex`, `grid-cols`, `sm:` variants) — plans 008 and 010.
- `hooks-editor.tsx` beyond the four class names listed — plan 001 replaces the editor.

## Git workflow

- Branch: `advisor/009-text-scales-and-reads`
- Two commits are natural: `Size controls in rem so they grow with the text`, then
  `Set body text to 14px and keep 12px for badges and metadata`. Style: capitalised
  imperative sentence, no prefix.
- `bunx prettier --write` on touched files before committing.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Control heights in rem

In `src/app/globals.css`, change lines 281–283 to:

```css
--spacing-control-sm: 2rem;
--spacing-control-md: 2.5rem;
--spacing-control-lg: 3rem;
```

(2rem = 32px, 2.5rem = 40px, 3rem = 48px at the default 16px root — identical today,
proportional when the root grows.)

**Verify**: `grep -nE "spacing-control-(sm|md|lg): *[0-9.]+rem;" src/app/globals.css` → 3 lines.
**Verify**: `grep -nE "spacing-control-(sm|md|lg): *[0-9]+px" src/app/globals.css` → no output.

### Step 2: Add the contrast rule to the guard test (it must fail first)

In `src/app/design-tokens.test.ts`, inside `describe("design tokens", …)`, add:

```ts
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
```

**Verify**: `bun test src/app/design-tokens.test.ts` → the new test fails listing exactly
five offenders: `plugin-list.tsx`, `settings-list.tsx`, `hooks-editor.tsx` (twice),
`master-detail.tsx`. Any other file in the list → STOP. Fewer (a file has none) → plan
001 or another plan already fixed it; continue.

### Step 3: Fix the five contrast sites

Change `text-gray-800` → `text-gray-900` on the five elements listed under "Where
`text-gray-800`… colour text". Nothing else on those lines yet.

**Verify**: `bun test src/app/design-tokens.test.ts` → all pass.
**Verify**: `grep -rn "text-gray-800" src --include="*.tsx" | grep -v "\.test\.tsx"` → no output.

### Step 4: The size sweep

Apply the "→ sm" table: on each listed element, replace `text-xs` with `text-sm`. Leave
the six "keep" sites alone. Work file by file; after each file, the file's
`grep -c "text-xs"` count should equal its number of "keep" rows (0 for most files;
1 for `master-detail.tsx`, `skill-list.tsx`, `mcp-server-list.tsx`, `plugin-list.tsx`,
`scope-switcher.tsx`, `badge.tsx`).

**Verify**: `grep -rn "text-xs" src --include="*.tsx" | grep -v "\.test\.tsx" | wc -l` → `6`.
**Verify**: `grep -rln "text-xs" src --include="*.tsx" | grep -v "\.test\.tsx" | sort` → exactly:

```
src/app/mcp/mcp-server-list.tsx
src/app/plugins/plugin-list.tsx
src/app/skills/skill-list.tsx
src/components/items/master-detail.tsx
src/components/scope-switcher.tsx
src/components/ui/badge.tsx
```

### Step 5: Look at it at two text sizes

Run `bun dev`. Open http://localhost:3000/settings, then in the console:
`document.documentElement.style.fontSize = "24px"` (150% of the default).

- Buttons ("Save", "Unset", the header nav) grow with their labels; no label is clipped
  at the top or bottom.
- Inputs and the scope select trigger grow to match.
- Descriptions under each key are readable without leaning in.

Set it back with `document.documentElement.style.fontSize = ""`.

**Verify**: with the 24px root, `[...document.querySelectorAll("button")].every(b => b.scrollHeight <= b.clientHeight + 1)` → `true`.

### Step 6: Full gate

**Verify**: `bun run typecheck` → exit 0.
**Verify**: `bun run lint` → exit 0.
**Verify**: `bun test src/app/design-tokens.test.ts src/components` → all pass.
**Verify**: `bunx prettier --check` on every file you changed → exit 0.

## Test plan

- New rule in `src/app/design-tokens.test.ts` (Step 2): bare `text-gray-700|800` anywhere
  in a component is a failure; variant-prefixed uses pass.
- No render tests for font sizes: happy-dom does not compute CSS, and class-name
  assertions for 30 sites would test the plan rather than the product. The grep gates in
  Step 4 are the check.
- Existing tests must keep passing unchanged. If a test asserts on a `text-xs` class you
  changed, STOP and report which — none was found when this plan was written
  (`grep -rn "text-xs" src --include="*.test.tsx"` is empty at `69744da`).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun test src/app/design-tokens.test.ts src/components` exits 0; the contrast test exists and passes
- [ ] `grep -nE "spacing-control-(sm|md|lg): *[0-9]+px" src/app/globals.css` → no output
- [ ] `grep -rn "text-gray-800" src --include="*.tsx" | grep -v "\.test\.tsx"` → no output
- [ ] `grep -rn "text-xs" src --include="*.tsx" | grep -v "\.test\.tsx" | wc -l` → `6`
- [ ] `git status --short` lists only in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `src/app/design-tokens.test.ts` does not exist (plan 007 has not landed).
- `setting-row.tsx`'s summary still has `shrink-0 items-center` (plan 008 has not landed;
  the reviewer asked for 008 first).
- The Step 2 failure lists a file not among the five.
- A `text-xs` site exists that is in neither table and you cannot classify it with the
  one-line rule — report it rather than guess.
- Changing a control height needs anything beyond the three values in `globals.css`
  (for example a component hard-codes `h-10`).

## Maintenance notes

- The rule going forward: `text-xs` is for `Badge` and one-line monospaced metadata; prose
  is `text-sm`. There is no test for it (happy-dom cannot see sizes), so it is a review
  item. Add it to `docs/design-system.md` if a later plan opens that file.
- Colour semantics: text is `gray-900` (secondary) or `gray-1000` (primary). The guard
  test enforces this for gray-700/800; `text-gray-600` and lighter are not in the rule
  because nothing uses them today — extend the regex if that changes.
- `--spacing-control-*` are the only px→rem change. If Geist publishes different control
  heights, update the rem values, not the unit.
- Reviewer: skim `/settings`, `/skills` and `/history` once at 100% and once at 150% text
  size. `/history`'s diff block at `text-sm` is the change most likely to feel too big; if
  so, `text-xs` on that one `<pre>` is a reasonable exception to record.
