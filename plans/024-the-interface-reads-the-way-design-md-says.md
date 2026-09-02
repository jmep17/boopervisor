# Plan 024: The interface reads the way DESIGN.md says: type roles, no pills for metadata, no nested boxes, labelled buttons

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 547101c..HEAD -- src/app/globals.css src/app/design-tokens.test.ts src/components/page-header.tsx src/components/settings/settings-list.tsx src/components/settings/setting-row.tsx src/components/settings/controls/hooks-editor.tsx src/components/settings/controls/permission-rules.tsx src/components/settings/controls/string-list.tsx src/components/items/master-detail.tsx src/components/history/history-row.tsx src/components/history/history-list.tsx src/app/mcp/mcp-server-list.tsx src/app/skills/skill-list.tsx src/app/plugins/plugin-list.tsx src/components/scope-switcher.tsx docs/design-system.md`
> Plans 018–023 change several of these on purpose; this plan locates every
> edit by content, not line number. Read the live files first. If a cited
> class or string is not found where described, treat it as a STOP condition.
>
> **Base check**: `git merge-base --is-ancestor 547101c HEAD && echo ok` prints
> `ok`, and plan 020 has landed (`DESIGN.md` exists and
> `grep -n 'describe("DESIGN.md rules"' src/app/design-tokens.test.ts` matches).

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (classes, labels and copy; no data flow changes)
- **Depends on**: plans/020-design-md-is-in-the-repo-and-enforced.md; run
  after 018, 022 and 023 to avoid conflicts in the controls they rewrite
- **Category**: tech-debt (design conformance)
- **Planned at**: commit `547101c`, 2026-09-01

## Why this matters

Plan 020 vendors `DESIGN.md` and tests the rules a regex can see. The rules
that need a reader were audited against the interface on 2026-09-01 and it
breaks six of them, all confirmed by reading the cited lines:

1. There is one heading role below the page title: every `h2`, `h3` and
   `h4` is `text-sm font-medium`, so an `h2` and an `h3` in the same panel
   look identical, and the token layer defines no type scale at all.
2. Twelve non-badge sites are `text-xs text-gray-900` — 12 px secondary
   text — including the whole hooks editor and one of its error messages.
3. Badges carry ordinary metadata: the winning scope on every settings row
   and every history row, a count, a duplicated "Uncatalogued", and a
   capability note.
4. The hooks editor nests a bordered box inside a bordered box inside the
   row's bordered card, with three different border alphas standing in for
   hierarchy.
5. The row-action buttons (move up, move down, remove) are icon-only,
   named only by `title`, and a red glyph is the only cue that one of
   them deletes; every "Add …" button carries a plus icon that says nothing
   its label does not.
6. Small inconsistencies: the item-state badge shows the raw enum
   (`disabled`), the History empty state is a bordered box while the item
   lists use plain text, and the hooks editor's labels are not associated
   with their inputs.

Each item quotes the rule it breaks in "Current state". Together they are
the difference between a token-correct interface and one that reads the way
the document asks.

## Current state

### 1. One heading role (DESIGN.md: "Use the published type roles and weight tokens. Do not create arbitrary font sizes or numeric font weights… `heading-24` for major section turns; `heading-20` and `heading-16` for nested structure" and "Establish hierarchy through typography before surfaces or color")

- `src/components/page-header.tsx:15` — `<h1 className="text-2xl font-semibold tracking-tight text-gray-1000">`
- `src/components/settings/settings-list.tsx:71,96,115` — `<h2 className="text-sm font-medium text-gray-1000">`
  (after plan 021 the topic `h2` lives in `filterable-settings.tsx`; same classes)
- `src/app/mcp/mcp-server-list.tsx:148` (`h2`) and `:175,189` (`h3`) — identical classes
- `src/app/skills/skill-list.tsx:81` (`h2`), `:104` (`h3`); `src/app/plugins/plugin-list.tsx:77` (`h2`), `:104` (`h3`)
- `src/components/settings/controls/hooks-editor.tsx:100` (`h4`); after plan 018 `permission-rules.tsx` has no heading
- `src/app/globals.css:155-293` — the `@theme inline` block defines colours,
  radii, shadows, fonts and `--spacing-control-*`; no `--text-*` role.
  Geist's published text roles are `heading-72 … heading-16`, `heading-14`,
  `label-*`, `copy-*` (https://vercel.com/geist/text).

### 2. Tiny muted prose (DESIGN.md: "never use tiny gray copy to make density fit"; "Tiny muted prose, arbitrary font sizes" is a rejected reflex)

`text-xs` sites outside `Badge`, at `547101c`:

- `src/components/settings/controls/hooks-editor.tsx:43` (an error: `text-xs text-red-900`), `:128`, `:171`, `:238`, `:252`, `:269`, `:304` (the `<pre>`), `:307`
- `src/components/items/master-detail.tsx:75` — the item detail line
- `src/app/plugins/plugin-list.tsx:81`, `src/app/skills/skill-list.tsx:82` — the manifest path
- `src/components/scope-switcher.tsx:67` — the project path under each option
- `src/components/ui/badge.tsx:7` — `text-xs font-medium` (the one place it stays)

The hooks editor's label lanes are `w-16` (`:172,238`), sized for 12 px.

### 3. Pills for metadata (DESIGN.md rejects "A badge, pill, or rounded capsule for ordinary metadata, chart annotations, or editorial labels")

- `src/components/settings/setting-row.tsx:75-87`:

```tsx
{
  isSet ? (
    <Badge className="shrink-0">{SCOPE_LABELS[winningScope]}</Badge>
  ) : null;
}
{
  definition ? null : (
    <Badge tone="warning" className="shrink-0">
      Uncatalogued
    </Badge>
  );
}
{
  dangerous ? (
    <Badge tone="warning" className="shrink-0">
      Confirms before writing
    </Badge>
  ) : null;
}
```

The "Uncatalogued" badge duplicates the summary two lines above it
(`:62-65`, "Not described by the catalog…").

- `src/components/settings/settings-list.tsx:115-118` — `<Badge tone="warning">{uncatalogued.length}</Badge>` beside the heading (in `filterable-settings.tsx` after 021).
- `src/components/history/history-row.tsx:61` — `{scopeLabel ? <Badge>{scopeLabel}</Badge> : null}`
- Badges that carry **state** and stay: `src/components/items/master-detail.tsx:70-72`
  (disabled/archived) and `hooks-editor.tsx:101-103` ("Not in the catalog").

### 4. Nested boxes (DESIGN.md: "Do not wrap every section, metric, or comparison in a card. Avoid nested panels" and "Cards nested inside cards, or borders used to repair weak hierarchy")

- Row card: `setting-row.tsx:55` — `rounded-base border border-gray-alpha-400 bg-background-100`
- Inside it, per event: `hooks-editor.tsx:96` — `rounded-base border border-gray-alpha-300 p-3`
- Inside that, per group: `hooks-editor.tsx:170` — `rounded-base border border-gray-alpha-200 p-2`

### 5. Icon buttons (DESIGN.md: "Prefer text labels unless an established icon makes an action materially faster to recognize"; "Use color only when it adds significant meaning … and pair it with a non-color cue"; "accessible names")

- `src/components/settings/controls/string-list.tsx:68-96` — three ghost
  buttons per entry, each `title="Move up" | "Move down" | "Remove entry"`
  with only an icon; the trash is `<TrashIcon className="size-4 text-red-900" />`.
  After plan 022 the entry input may be a `Picker`; the buttons are unchanged.
- `src/components/settings/controls/permission-rules.tsx` — the same trio per
  rule (plan 018 rewrote the control; the buttons keep `title`s `Move up`,
  `Move down`, `Remove rule`).
- `hooks-editor.tsx:182-190,281-289,312-320` — three trash-only buttons, `title="Remove group" | "Remove hook"`.
- `PlusIcon` beside a text label: `string-list.tsx:105`, `permission-rules.tsx` ("Add rule"), `hooks-editor.tsx:111,218`.
- `src/components/ui/button.tsx:22` defines a `danger` variant nothing uses.
- Tests that find these buttons by accessible name: `string-list.test.tsx:74-76,89-91`
  (`/remove entry/i`, `/move down/i`), `permission-rules.test.tsx` (plan 018's
  version: `/remove/i`, `/move down/i`), `hooks-editor.test.tsx` (check with
  `grep -n "name:" src/components/settings/controls/hooks-editor.test.tsx`).
  An `aria-label` that _contains_ the old words keeps them passing.

### 6. Small inconsistencies

- `master-detail.tsx:17-21,71` — `STATE_TONE` maps state to a tone and the
  badge renders `{item.state}` raw; `item-state-controls.tsx:56` labels the
  same states `Enable`/`Disable`/`Archive`.
- `history-list.tsx:16-20` — empty state is
  `<div className="flex items-center justify-center rounded-base border border-gray-alpha-400 bg-background-100 px-6 py-12"><p className="text-sm text-gray-900">No changes yet.</p></div>`;
  `master-detail.tsx:83` renders its empty state as a plain `<li className="px-3 py-2 text-sm text-gray-900">`.
- `hooks-editor.tsx:172,238,252` — `<label>` elements ("Matcher:",
  "Command:", "Timeout (seconds):") with no `htmlFor` and no wrapped input,
  so those inputs have no accessible name.

### Conventions

- Token layer and guard: `docs/design-system.md`, `src/app/design-tokens.test.ts`
  (plan 020 added a `describe("DESIGN.md rules")` block and a `copyLines`
  helper; add the type-scale rule there).
- Tailwind v4 theme font sizes: `--text-<name>: <size>;` with
  `--text-<name>--line-height: <lh>;` yields the utility `text-<name>`
  carrying both.
- Copy rules: sentence case, no em dash, `…`.

## Commands you will need

| Purpose                            | Command                                  | Expected on success              |
| ---------------------------------- | ---------------------------------------- | -------------------------------- |
| Route types (once, fresh worktree) | `bunx next typegen`                      | `✓ Types generated successfully` |
| Typecheck                          | `bun run typecheck`                      | exit 0                           |
| Lint                               | `bun run lint`                           | exit 0                           |
| Tests                              | `bun test`                               | `0 fail`                         |
| Guard                              | `bun test src/app/design-tokens.test.ts` | all pass                         |
| Format                             | `bunx prettier --check <touched files>`  | exit 0                           |
| Dev server                         | `bun dev`                                | http://127.0.0.1:3000            |

## Scope

**In scope**:

- `src/app/globals.css` (type roles in the `@theme` block), `src/app/design-tokens.test.ts` (one rule)
- `docs/design-system.md` (one paragraph on type roles)
- `src/components/page-header.tsx`
- `src/components/settings/settings-list.tsx` and/or `filterable-settings.tsx` (headings, count)
- `src/components/settings/setting-row.tsx` (badges, and the details sentence)
- `src/components/settings/controls/hooks-editor.tsx`, `permission-rules.tsx`, `string-list.tsx` (+ their tests where names change)
- `src/components/items/master-detail.tsx`, `master-detail.test.tsx` if it asserts on the badge text
- `src/components/history/history-row.tsx`, `history-list.tsx`
- `src/app/mcp/mcp-server-list.tsx`, `src/app/skills/skill-list.tsx`, `src/app/plugins/plugin-list.tsx` (heading classes, one `text-xs` each)
- `src/components/scope-switcher.tsx` (one class)
- `plans/README.md` (status row)

**Out of scope**:

- `src/components/ui/badge.tsx` — keeps `text-xs`; it is the exemption.
- The `<details>/<summary>` row element and the row card border — decided.
- Any control's data flow, hidden fields, or the `Picker`.
- `hooks-editor.tsx`'s value import of `@/lib/catalog/hooks` — a bundle
  hygiene item in the index; not a design change.
- The description-row duplication (`setting-details.tsx`, `setting-row.tsx`,
  `settings-list.tsx` all hand-write the same `dt/dd` classes) — a candidate
  in the index, not this plan.

## Git workflow

- Branch: `advisor/024-the-interface-reads-the-way-design-md-says`, from `main` after 020–023.
- Commit per step; imperative sentence, no prefix.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Three type roles in the theme, and a guard

In `src/app/globals.css`, inside `@theme inline` after the
`--spacing-control-*` lines, add:

```css
/* Geist text roles (https://vercel.com/geist/text), the three this interface uses:
     the page title, a section heading, and a heading inside a panel. Body copy is
     Tailwind's `text-sm` (14px) and `text-base` (16px). */
--text-heading-24: 1.5rem;
--text-heading-24--line-height: 2rem;
--text-heading-16: 1rem;
--text-heading-16--line-height: 1.5rem;
--text-heading-14: 0.875rem;
--text-heading-14--line-height: 1.25rem;
```

Apply them:

- `page-header.tsx`: `h1` → `text-heading-24 font-semibold tracking-tight text-gray-1000`.
- Every `h2` listed in "Current state" 1 → `text-heading-16 font-semibold text-gray-1000`.
- Every `h3`/`h4` listed → `text-heading-14 font-semibold text-gray-1000`.

In `design-tokens.test.ts`, inside the `DESIGN.md rules` block, add
`font sizes are the type roles or body sizes`: flag
`/\btext-(?:xs|lg|xl|2xl|3xl|4xl|5xl)\b/` in every source file except
`src/components/ui/badge.tsx`. (It will fail until step 2 is done; that is
the point — run it now to see the list matches "Current state" 2.)

In `docs/design-system.md`, add a bullet under the three "keeps" (after
Controls): `**Type roles.** \`--text-heading-24/16/14\` in the same theme
block: page title, section, panel heading. Body is \`text-sm\`; only \`Badge\`
may use \`text-xs\`. \`DESIGN.md\` is the reason.`

**Verify**: `bun run lint` → 0; the new guard test lists exactly the `text-xs`
sites from "Current state" 2 (minus `badge.tsx`).

### Step 2: No tiny muted prose

Change every listed `text-xs` (outside `badge.tsx`) to `text-sm`. In
`hooks-editor.tsx` widen the label lanes from `w-16` to `w-24` and make the
error at the top `text-sm text-red-900`. The `<pre>` at `:304` becomes
`text-sm`.

**Verify**: `bun test src/app/design-tokens.test.ts` → all pass;
`grep -rn "text-xs" src --include='*.tsx' | grep -v badge.tsx | grep -v '\.test\.'` → no matches.

### Step 3: Badges only for state

- `setting-row.tsx`: replace the winning-scope `Badge` with
  `<span className="shrink-0 text-sm text-gray-900">{SCOPE_LABELS[winningScope]}</span>`;
  delete the "Uncatalogued" badge (the summary sentence already says it);
  delete the "Confirms before writing" badge and instead, at the top of the
  expanded body (before `<SettingDetails>`), render for dangerous keys:
  `<p className="text-sm text-gray-900">Asks before writing. {definition.overrideNote}</p>`.
- The Uncatalogued heading (`settings-list.tsx` or `filterable-settings.tsx`):
  `<h2 …>Uncatalogued <span className="font-normal text-gray-900">({count})</span></h2>`.
- `history-row.tsx`: the scope becomes `<span className="shrink-0 text-sm text-gray-900">{scopeLabel}</span>`.
- Remove the now-unused `Badge` imports.

Update any test asserting on those badges (`grep -rn "Confirms before writing\|Uncatalogued" src --include='*.test.tsx'`).

**Verify**: `grep -rn "<Badge" src --include='*.tsx' | grep -v '\.test\.'` → exactly two sites:
`master-detail.tsx` and `hooks-editor.tsx`. `bun test src/components` → all pass.

### Step 4: Unnest the hooks editor

In `hooks-editor.tsx`:

- The per-event wrapper (`rounded-base border border-gray-alpha-300 p-3`) →
  `flex flex-col gap-2` with no border or padding; events are separated by
  the parent's `gap-3` → make it `gap-6` so the turn between events is
  clearly larger than the rhythm inside one (DESIGN.md: "Content group →
  new section: clearly larger").
- The per-group wrapper (`rounded-base border border-gray-alpha-200 p-2`) →
  `flex flex-col gap-2 border-l-2 border-gray-alpha-400 pl-3`: one left
  rule marks a group without boxing it. This is the single boundary level
  allowed inside a row.
- The event heading is `text-heading-14 font-semibold` from step 1.

**Verify**: `grep -n "border border-gray-alpha" src/components/settings/controls/hooks-editor.tsx` → no matches
(the `<pre>` at the old `:304` keeps its `border border-gray-alpha-400`; if it
matches, it is the only allowed one — check the line). `bun test src/components/settings/controls/hooks-editor.test.tsx` → all pass.

### Step 5: Buttons that say what they do

In `string-list.tsx`, `permission-rules.tsx` and `hooks-editor.tsx`:

- Every icon-only button gets an `aria-label` with the row's position, and
  keeps `title` for the tooltip: `Move entry ${index + 1} up`,
  `Move entry ${index + 1} down`, `Remove entry ${index + 1}` (rules:
  `Move rule …`, `Remove rule …`; hooks: `Remove group ${index + 1}`,
  `Remove hook ${index + 1}`). Existing tests match `/remove entry/i`,
  `/move down/i` etc.; these labels still match.
- Drop `text-red-900` from every `TrashIcon`; the button's label is the cue.
  Delete the `danger` variant from `button.tsx` **only if** `grep -rn 'variant="danger"' src` finds no use (it is unused today; removing it is
  optional — leave it if unsure).
- Remove the `PlusIcon` from every "Add …" button; the text stays. Delete
  the unused `PlusIcon` imports.
- Give every lucide icon `aria-hidden="true"` (`<TrashIcon aria-hidden="true" className="size-4" />`).

**Verify**: `grep -rn "PlusIcon" src --include='*.tsx'` → no matches;
`grep -rn "text-red-900" src/components/settings/controls` → only error text (`<p>`), no icons;
`bun test src/components/settings/controls` → all pass.

### Step 6: Consistent labels and empty states

- `master-detail.tsx`: add `const STATE_LABEL = { enabled: "Enabled", disabled: "Disabled", archived: "Archived" } as const;`
  beside `STATE_TONE` and render `{STATE_LABEL[item.state]}` in the badge.
- `history-list.tsx`: the empty state becomes `<p className="text-sm text-gray-900">No changes yet.</p>`.
- `hooks-editor.tsx`: the three `<label>`s get `htmlFor` ids from `useId()`
  and the matching `Input`s the same `id` (one `useId()` per editor
  instance, suffixed `-matcher`, `-command`, `-timeout`).

**Verify**: `bun test src/components/items src/components/history src/components/settings/controls/hooks-editor.test.tsx` → all pass
(update `master-detail.test.tsx` if it asserts on the lowercase state text).

### Step 7: Gates, look, index

`bun run typecheck` 0 · `bun run lint` 0 · `bun test` 0 fail · prettier
check on touched files 0. Manual (`bun dev`): `/settings` — rows show the
scope as plain text, the Uncatalogued count is in the heading; expand
`hooks` — events are separated by space, groups by a left rule, no box in a
box, labels 14 px; `/history` — no pills; `/skills` — the state badge reads
"Disabled". Both themes (toggle the OS setting) read the same hierarchy.
Update the index row.

## Test plan

- Step 1's guard test is the new automated check; it must fail before step 2 and pass after.
- Existing control tests keep passing with the new `aria-label`s (they match by substring).
- No new component tests are required; this plan changes presentation only.

## Done criteria

- [ ] `bun run typecheck`, `bun run lint`, `bun test` exit 0; `bun test src/app/design-tokens.test.ts` → 11 pass
- [ ] `grep -n "text-heading-24\|text-heading-16\|text-heading-14" src/app/globals.css` → 3 size definitions (6 lines with line-heights)
- [ ] `grep -rn "text-xs" src --include='*.tsx' | grep -v badge.tsx | grep -v '\.test\.'` → no matches
- [ ] `grep -rn "<Badge" src --include='*.tsx' | grep -v '\.test\.' | wc -l` → 2
- [ ] `grep -rn "PlusIcon" src --include='*.tsx'` → no matches
- [ ] `grep -c "aria-label" src/components/settings/controls/string-list.tsx` ≥ 3
- [ ] `git status --short` shows nothing outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

- `DESIGN.md` or the `describe("DESIGN.md rules")` block is absent (plan 020 not landed).
- A cited class or string is not found where "Current state" says, and
  plans 018–023 do not explain the move.
- `master-detail.test.tsx` or `hooks-editor.test.tsx` asserts on markup
  this plan removes in a way that needs the test's _intent_ changed rather
  than its selector — report which assertion.
- A step's verification fails twice.

## Maintenance notes

- New headings use `text-heading-16` (section) or `text-heading-14` (inside
  a panel); the guard refuses Tailwind's default sizes above `text-base`.
- `Badge` is for item state and for warnings about data ("Not in the
  catalog"); metadata is plain secondary text.
- The description-row duplication across `setting-details.tsx`,
  `setting-row.tsx` and the files list is the next conformance step
  (DESIGN.md: "Label → value → detail: identical across peers"); a shared
  `DescriptionRow` would sit next to `page-header.tsx`.
- Reviewer focus: the hooks editor at 14 px in both themes, and that no
  icon-only button lost its name (`getAllByRole("button")` with a name).
