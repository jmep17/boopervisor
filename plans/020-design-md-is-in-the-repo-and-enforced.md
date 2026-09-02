# Plan 020: Vercel's design.md lives in the repo as `DESIGN.md`, agents are told to read it, and its checkable rules are tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 547101c..HEAD -- AGENTS.md docs/design-system.md docs/PLAN.md src/app/globals.css src/app/design-tokens.test.ts src/components/settings/settings-list.tsx src/components/settings/setting-row.tsx src/components/settings/settings-file-switch.tsx src/components/settings/controls/hooks-editor.tsx src/components/settings/confirm-write-dialog.tsx src/components/history/history-row.tsx src/components/items/master-detail.tsx`
> Plans 018 and 019 may have changed `setting-row.tsx` and `hooks-editor.tsx`;
> the lines this plan edits there are located by content, not number. Any
> other in-scope change: compare the "Current state" excerpts against the
> live code; on a mismatch, treat it as a STOP condition.
>
> **Base check**: `git merge-base --is-ancestor 547101c HEAD && echo ok` must print `ok`.

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: LOW (a document, a test, and copy/class changes with no logic)
- **Depends on**: none (018/019 recommended first only to avoid merge noise in `setting-row.tsx`)
- **Category**: docs + dx
- **Planned at**: commit `547101c`, 2026-09-01

## Why this matters

The operator asked for Vercel's `DESIGN.md` to be in the project and
respected. Vercel publishes it at https://vercel.com/design.md as "one public
file any agent can load" (their post: https://vercel.com/blog/how-our-agents-build-on-brand-pages-with-design-md).
Boopervisor already builds on Geist tokens (`docs/design-system.md`), so the
document's typography, colour, restraint and accessibility rules are the
missing half: the _judgement_ layer above the token layer.

"Respected" has to mean something an executor and a reviewer can check. This
plan does three things: vendors the file with provenance and a section saying
which of its rules apply to a product UI (it was written for report sites);
tells agents to read it from `AGENTS.md`, the file Claude Code loads; and
turns every rule that a regex can check into a case in the existing token
guard test — then fixes the sites that test flags today. Rules that need a
human eye (hierarchy, badges, nested cards, icon buttons) are audited and
fixed in plan 024, not here.

## Current state

- `AGENTS.md` — holds only the block Next.js manages between
  `<!-- NEXT-AGENTS-MD-START -->` / `<!-- NEXT-AGENTS-MD-END -->` markers.
  Next's `generate-agent-files.js` (`node_modules/next/dist/server/lib/generate-agent-files.js:145-158`)
  replaces the text _between_ the markers and leaves everything outside them
  alone, so a section above the block is safe. `CLAUDE.md` is `@AGENTS.md`.
- `docs/design-system.md` (35 lines) — where the Geist tokens came from and
  how they are guarded. Its first paragraph says Vercel publishes "fonts but
  no React component package".
- `docs/PLAN.md:74-79` — the "Design system" section, four sentences.
- `src/app/design-tokens.test.ts` (111 lines) — scans every non-test
  `src/**/*.tsx` for colour classes not in the theme, non-Geist radii, and
  low-contrast text. Structure to extend (`:54-59,70-80`):

```ts
function sourceFiles(): string[] {
  const glob = new Glob("src/**/*.tsx");
  return [...glob.scanSync({ cwd: ROOT })]
    .filter((file) => !file.endsWith(".test.tsx"))
    .sort();
}
...
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
```

- `src/app/globals.css` (298 lines) — tokens; no `prefers-reduced-motion`
  block. The only motion in the app is `transition-colors` (button, control,
  checkbox, dialog) and the switch thumb's `transition-transform`
  (`src/components/ui/switch.tsx:27`).

### What the checkable rules flag today (confirmed by grep at `547101c`)

Em dashes in user-visible copy (design.md: "Avoid em dashes"):

- `src/components/settings/settings-list.tsx:27` — `"invalid-json": "not valid JSON — left untouched",`
- `src/components/settings/setting-row.tsx:108` — `{scope === winningScope ? " — wins" : null}`
- `src/components/settings/settings-file-switch.tsx:27` — `Project — .claude/settings.json`
- `src/components/settings/settings-file-switch.tsx:37` — `Project-local — .claude/settings.local.json`
- `src/components/settings/controls/hooks-editor.tsx:273` — `Boopervisor never writes that file — open it to change what the`
- `src/components/settings/setting-details.tsx:32` — `definition.perSessionOverrides !== "—";` — **not copy**: it compares
  against the placeholder the reference uses in its own table. Keep it, mark it allowed.

Three ASCII dots where the app elsewhere uses `…` (`scope-switcher.tsx:123`
"Checking…", the five Suspense fallbacks):

- `src/components/history/history-row.tsx:145` — `"Restoring..."`
- `src/components/settings/confirm-write-dialog.tsx:61` — `"Writing..."`
- `src/components/settings/setting-row.tsx:152,156` — `"Saving"` (no ellipsis at all)

Flex children that hold long strings without `min-w-0` (design.md: "Give
grid and flex children `min-width: 0`; reflow before shrinking"):

- `src/components/items/master-detail.tsx:68-69`:

```tsx
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate">{item.label}</span>
```

`truncate` never engages on a flex child whose `min-width` is `auto`.

- `src/components/history/history-row.tsx:53-59`:

```tsx
        <summary className="flex cursor-pointer items-baseline justify-between gap-4 px-4 py-3">
          <span className="flex flex-col gap-1">
            <span className="text-sm text-gray-1000">{targetLabel}</span>
            <span className="text-sm text-gray-900">
              <span className="font-mono">{record.path}</span> {timeStr}
            </span>
          </span>
```

`record.path` is an absolute path; the sibling at `:60` is `shrink-0`.

No `uppercase`, `tracking-wide*`, gradient, blur, `animate-*`, arbitrary
`text-[`/`leading-[`/`font-[` classes exist today (`tracking-tight` on the
two headings is optical tightening, not an eyebrow, and is allowed).

### The document to vendor

Fetched 2026-09-01 by the advisor: 369 lines, 5,443 words, sha256 starting
`2b40b23712e54872`. It has YAML frontmatter (`name: vercel-brand-guidelines`
and a `description`) and these headings, in order:

```
# Design report websites like Vercel
## Vercel product and brand context
## Use this priority order
## Integrate with the caller's project
## Work in four passes
### Frame the reader's job
### Choose the composition
### Authoritative Vercel visual system
#### Authorship shell
#### Grid and alignment
#### Typography and rhythm
#### Color, surfaces, and boundaries
#### Data and evidence
#### Calculators and interaction
#### Motion and delight
#### Media and icons
### Inspect and revise privately
## Reject generated-design reflexes
## Use the published CSS API
## Accessibility and responsive behavior
```

No licence or copyright line appears in the file.

### Conventions

- Prose docs in this repo: sentence-case headings, short paragraphs, British
  spelling ("colour", "honour") in `docs/` and the index. Match them.
- Any string you add to a `.tsx` must itself pass the new rules.

## Commands you will need

| Purpose                            | Command                                                            | Expected on success              |
| ---------------------------------- | ------------------------------------------------------------------ | -------------------------------- |
| Fetch the document                 | `curl -fsSL https://vercel.com/design.md -o /tmp/vercel-design.md` | exit 0                           |
| Route types (once, fresh worktree) | `bunx next typegen`                                                | `✓ Types generated successfully` |
| Typecheck                          | `bun run typecheck`                                                | exit 0                           |
| Lint                               | `bun run lint`                                                     | exit 0                           |
| Token guard                        | `bun test src/app/design-tokens.test.ts`                           | all pass                         |
| Tests                              | `bun test`                                                         | `0 fail`                         |
| Format                             | `bunx prettier --check <touched files>`                            | exit 0                           |

## Scope

**In scope**:

- `DESIGN.md` (create, repo root)
- `.prettierignore` (one entry, see step 2a)
- `AGENTS.md` (add a section above the Next block)
- `docs/design-system.md`, `docs/PLAN.md` (one pointer paragraph each)
- `src/app/design-tokens.test.ts`
- `src/app/globals.css` (reduced-motion block only)
- `src/components/settings/settings-list.tsx` (line 27 only)
- `src/components/settings/setting-row.tsx` (the `wins` text and the two `Saving` strings only)
- `src/components/settings/settings-file-switch.tsx` (two link labels)
- `src/components/settings/controls/hooks-editor.tsx` (one sentence)
- `src/components/settings/setting-details.tsx` (one marker comment)
- `src/components/settings/confirm-write-dialog.tsx` (one string)
- `src/components/history/history-row.tsx` (one string, two classes)
- `src/components/items/master-detail.tsx` (one class)
- `plans/README.md` (status row; and delete the "theme choice" direction candidate, see step 8)

**Out of scope**:

- The `vercel-brand.css` stylesheet and every `vbg-*` class — this app uses
  its own Geist token layer; do not link, copy or import that CSS.
- Badges, heading hierarchy, nested borders, icon buttons, `text-xs` — plan 024.
- Any component logic.

## Git workflow

- Branch: `advisor/020-design-md-is-in-the-repo-and-enforced`, from `main`.
- Commit per step; imperative sentence, no prefix.
- Pre-commit runs prettier, typecheck, tests. Prettier will format
  `DESIGN.md`; that is fine, but check step 1's verbatim section still
  matches the fetched text apart from whitespace (`diff -w`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fetch the document and check it is the one this plan describes

```
curl -fsSL https://vercel.com/design.md -o /tmp/vercel-design.md
grep -n '^#' /tmp/vercel-design.md
```

Compare the heading list with the one in "Current state". If a heading was
added, removed or renamed, STOP and report the diff: the applicability
section in step 2 was written against those sections.

**Verify**: `wc -w /tmp/vercel-design.md` → roughly 5,400 (±10%);
`grep -c '^#' /tmp/vercel-design.md` → 20.

### Step 2: Write `DESIGN.md`

Create `DESIGN.md` at the repo root with this structure. Sections 1 and 2
are authored here (paste them); section 3 is the fetched file's body with
its YAML frontmatter (the leading `---` block) removed and nothing else changed.

```markdown
# Design guidelines

Boopervisor's interface follows Vercel's design.md, reproduced below, on top
of the Geist token layer described in `docs/design-system.md`. Read both
before changing anything under `src/app/` or `src/components/`.

## Provenance

- Source: https://vercel.com/design.md, fetched <YYYY-MM-DD> (<N> words).
  Vercel publishes it as "one public file any agent can load"
  (https://vercel.com/blog/how-our-agents-build-on-brand-pages-with-design-md).
- Reproduced verbatim under "Vercel's design.md" below, minus its YAML
  frontmatter (`name: vercel-brand-guidelines` and a description), which is
  skill metadata rather than guidance.
- To refresh: fetch the URL again, replace the verbatim section, then re-read
  "How Boopervisor applies it" against the new headings. Note the date here.

## How Boopervisor applies it

Vercel wrote the document for report websites: customer proposals, benchmarks,
calculators. Boopervisor is a product interface, so:

**Applies as written.** Typography and rhythm; Color, surfaces, and boundaries;
Motion and delight; Media and icons; Reject generated-design reflexes;
Accessibility and responsive behavior; and the table rules in Data and
evidence wherever the interface renders rows of label and value (a settings
list is a table in everything but markup). The "Use this priority order"
list applies with "the reader's question" read as "the user's task".

**Does not apply.** Authorship shell (the wordmark header and triangle
footer); Use the published CSS API and every `vbg-*` class or `--vbg-*`
token, because the interface has its own token layer in `src/app/globals.css`
and must not load `vercel-brand.css`; Calculators and interaction; the chart
guidance in Data and evidence; Frame the reader's job, Choose the composition
and Inspect and revise privately, which describe authoring a one-off page.

**Where it meets an existing decision.** The document says "Light and dark
themes are implicit; do not add a visible switcher"; that closes the theme
toggle candidate from the 2026-08-30 audit. Vocabulary in copy follows
`CONTEXT.md` (a setting, a scope, an item, a mutation) before any term in the
document. Rows use native `<details>` disclosure by decision (plans/README.md).

**Checked by a test.** `src/app/design-tokens.test.ts` fails on: a colour or
radius class that is not a Geist token; readable text in gray-700/800; an em
dash or `...` in interface copy; `uppercase` or wide tracking; gradients,
blur, `animate-*` or arbitrary type values; and any transition other than
`transition-colors` (the switch thumb excepted). Everything else in the
document is judgement, and the reviewer's job.

## Vercel's design.md

<the fetched body, frontmatter removed>
```

Fill in `<YYYY-MM-DD>` and `<N>` from step 1.

**Verify**: `diff -w <(sed -n '/^# Design report websites like Vercel/,$p' DESIGN.md) <(sed -n '/^# Design report websites like Vercel/,$p' /tmp/vercel-design.md)` → empty output.
`grep -c '^## ' DESIGN.md` → 10 (your 3 plus the document's 7).

### Step 2a: Keep prettier off the vendored bytes

The pre-commit hook runs prettier, which reformats the HTML inside the
document's fenced code blocks: it self-closes void elements (`<link ...>`
becomes `<link ... />`), rewraps long attribute lists, and splits a nested
`<span>`. That silently edits text this file promises to reproduce verbatim,
and it breaks step 2's `diff -w`.

`.prettierignore` already exempts generated and vendored artifacts
(`bun.lock`, `.next`). Append `DESIGN.md` to it, with the reason:

```
# Vendored verbatim from https://vercel.com/design.md; reformatting it would
# rewrite text this repo promises to reproduce unchanged.
DESIGN.md
```

Format the authored sections 1 and 2 by hand to the repo's prettier settings
(80-column prose, `-` bullets) since prettier will no longer do it for you.

**Verify**: `git add DESIGN.md .prettierignore && git commit` succeeds, then
re-run step 2's `diff -w` → empty output. If it is not empty, STOP.

### Step 3: Point agents and docs at it

`AGENTS.md`: insert **above** the `<!-- BEGIN:nextjs-agent-rules -->` line.
(The plan first named `<!-- NEXT-AGENTS-MD-START -->`; that is the _legacy_
marker at `generate-agent-files.js:51-52`. The live pair is
`BEGIN:`/`END:nextjs-agent-rules` at `:45-46`, and it is what this repo's
`AGENTS.md` actually carries.) The section:

```markdown
# Design

Read `DESIGN.md` before changing anything under `src/app/` or
`src/components/`. It is Vercel's design.md with a section on which rules
apply here; `docs/design-system.md` is the token layer under it, and
`bun test src/app/design-tokens.test.ts` enforces the checkable rules.
```

`docs/design-system.md`: after the first paragraph, add:

```markdown
The judgement above the tokens — typography roles, restraint, copy, motion,
accessibility — is `DESIGN.md` at the repo root, Vercel's own design.md with
a note on what applies to a product interface.
```

`docs/PLAN.md`, end of the "Design system" section: add one sentence:
`Vercel's design.md is vendored as \`DESIGN.md\` and governs everything the tokens do not.`

**Verify**: `grep -n "DESIGN.md" AGENTS.md docs/design-system.md docs/PLAN.md` → three matches;
`grep -c "BEGIN:nextjs-agent-rules" AGENTS.md` → 1 (the Next block is intact).

### Step 4: Add the checkable rules to the token guard

In `src/app/design-tokens.test.ts`, add this helper next to `sourceFiles()`:

```ts
/**
 * Source split into lines twice: as written, and with comments blanked out
 * (block comments become the same number of empty lines, so indices match).
 * Copy rules check the stripped line; the allow marker is read from the original.
 */
function copyLines(source: string): { original: string[]; stripped: string[] } {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  return { original: source.split("\n"), stripped: stripped.split("\n") };
}

const ALLOW_MARKER = "design-tokens-allow";
```

Then a new `describe("DESIGN.md rules", ...)` with these tests, each
collecting `offenders` as `${file}:${line + 1}: ${text}` and expecting `[]`:

1. `interface copy has no em dashes` — for each file, for each line index,
   skip when `original[i].includes(ALLOW_MARKER)`; flag when
   `stripped[i].includes("—")`.
2. `an ellipsis is the character, not three dots` — flag lines matching
   `/[A-Za-z]\.\.\./` (a spread is `...props`, preceded by `{`, `(` or a
   space, so this only catches copy).
3. `no all-caps eyebrows or tracked labels` — flag
   `/\b(?:uppercase|tracking-(?:wide|wider|widest))\b/` anywhere in the source.
4. `no decorative effects` — flag `/\b(?:bg-gradient-|backdrop-blur|blur-|animate-(?!none\b)|shadow-\[)/`.
5. `no arbitrary type values` — flag `/\b(?:text|leading|font|tracking)-\[/`.
6. `motion is colour transitions only` — flag `/\btransition-(?!colors\b)[a-z]+/`
   except in `src/components/ui/switch.tsx` (the thumb slides).

In `src/components/settings/setting-details.tsx`, append the marker to the
comparison line so rule 1 skips it:

```ts
definition.perSessionOverrides !== "—"; // design-tokens-allow: the reference's own placeholder
```

**Verify**: `bun test src/app/design-tokens.test.ts` → the six new tests
report offenders exactly at the sites listed in "Current state" (5 em-dash
lines, 2 `...` lines) and nowhere else. If a site you did not expect appears,
STOP: either the regex is wrong or the code drifted.

### Step 5: Fix the copy the test flags

- `settings-list.tsx`: `"invalid-json": "not valid JSON, left untouched",`
- `setting-row.tsx`: `{scope === winningScope ? " (wins)" : null}`
- `settings-file-switch.tsx`, both links: replace the dash with a mono span:
  `Project <span className="font-mono">.claude/settings.json</span>` and
  `Project-local <span className="font-mono">.claude/settings.local.json</span>`
  (paths are set in Geist Mono per design.md; the label stays in Sans).
- `hooks-editor.tsx`: `Boopervisor never writes that file. Open it to change what the hook does.`
- `history-row.tsx`: `"Restoring…"`; `confirm-write-dialog.tsx`: `"Writing…"`;
  `setting-row.tsx`: both `"Saving"` → `"Saving…"`.

Check tests that pin these strings: `grep -rn "Writing\.\.\.\|Restoring\.\.\.\|— wins\|left untouched" src --include='*.test.tsx'`
returned nothing at `547101c`; if plan 019 added a `Saving` assertion, update it.

**Verify**: `bun test src/app/design-tokens.test.ts` → all pass; `bun test src/components` → all pass.

### Step 6: Let long strings shrink

- `master-detail.tsx`: the inner label span becomes `className="min-w-0 truncate"`.
- `history-row.tsx`: the first child of `<summary>` becomes
  `className="flex min-w-0 flex-col gap-1"` and the path span
  `className="break-all font-mono"` (matching `settings-list.tsx:80`).

**Verify**: `bun test src/components/items src/components/history` → all pass
(`master-detail.test.tsx` exists; nothing there asserts on these classes).

### Step 7: Respect reduced motion

Append to `src/app/globals.css`:

```css
/* DESIGN.md: "Keep the base experience complete without motion and respect
   reduced-motion preferences." The only motion is colour transitions and the
   switch thumb; both are dropped here. */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0s;
    animation-duration: 0s;
  }
}
```

**Verify**: `grep -n "prefers-reduced-motion" src/app/globals.css` → 1 match; `bun run lint` → 0.

### Step 8: Gates, index, and the closed candidate

Run all gates. In `plans/README.md`, update this plan's row, and under
"Direction candidates from the frontend audit" replace the "A theme choice
(system / light / dark)" bullet's text with one line:
`Closed by DESIGN.md (plan 020): "Light and dark themes are implicit; do not add a visible switcher."`

**Verify**: `bun run typecheck` 0 · `bun run lint` 0 · `bun test` 0 fail ·
`bunx prettier --check AGENTS.md docs/design-system.md docs/PLAN.md src/app/design-tokens.test.ts src/app/globals.css` (not `DESIGN.md`, ignored per step 2a) and every `.tsx` you touched → exit 0.

## Test plan

Step 4 is the test plan: six new guard cases, each proven against the known
offenders before the fixes (they must fail first) and green after step 5.
No component tests change in meaning; a string assertion may need the new
text.

## Done criteria

- [ ] `DESIGN.md` exists; `diff -w` of its verbatim section against the fetched file is empty
- [ ] `grep -n "DESIGN.md" AGENTS.md docs/design-system.md docs/PLAN.md` → 3 matches
- [ ] `grep -c '^## ' DESIGN.md` → 10; `grep -n "^DESIGN.md$" .prettierignore` → 1 match
- [ ] `bun test src/app/design-tokens.test.ts` → 10 pass (4 existing + 6 new), 0 fail
- [ ] `grep -rn "—" src --include='*.tsx' | grep -v '^\s*//' | grep -v design-tokens-allow | grep -v '^\S*:\s*\*'` → only comment lines (eyeball: no JSX text or string literal)
- [ ] `grep -rn '[A-Za-z]\.\.\.' src --include='*.tsx'` → no matches
- [ ] `grep -n "prefers-reduced-motion" src/app/globals.css` → 1 match
- [ ] `bun run typecheck`, `bun run lint`, `bun test` all exit 0
- [ ] `git status --short` shows nothing outside the in-scope list
- [ ] `plans/README.md` status row updated and the theme candidate closed

## STOP conditions

- The fetch fails or returns something other than Markdown with the 20
  headings listed. Do not substitute a community "DESIGN.md" for vercel.com
  (getdesign.md, design-bites); those are third-party reconstructions, not
  Vercel's file.
- The fetched file now carries a licence or terms line. Report it; whether to
  vendor or link is the operator's call.
- Step 4's new tests flag a site not listed in "Current state".
- A step's verification fails twice.

## Maintenance notes

- Plan 024 does the judgement-based conformance (badges, hierarchy, nested
  borders, icons, `text-xs`) and adds a type-scale guard; it assumes this
  plan's `copyLines` helper and `describe("DESIGN.md rules")` block exist.
- When Vercel updates design.md, refresh per the Provenance section and re-run
  the guard; new checkable rules go into the same `describe`.
- Reviewer focus: the `diff -w` in step 2 (nothing paraphrased), and that
  `AGENTS.md`'s Next block is still intact after `next dev` runs once.
