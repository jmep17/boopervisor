# Plan 021: `/settings` has find-as-you-type over setting names, with the match count and the query in the URL

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 547101c..HEAD -- src/app/settings/page.tsx src/components/settings/settings-list.tsx src/lib/config/editing-scope.ts`
> Plan 020 changes one string in `settings-list.tsx` (line 27); anything else
> changed: compare the "Current state" excerpts against the live code; on a
> mismatch, treat it as a STOP condition.
>
> **Base check**: `git merge-base --is-ancestor 547101c HEAD && echo ok` must print `ok`.

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: LOW (additive; the rows themselves are untouched)
- **Depends on**: none (020 recommended first for the copy rules its test enforces)
- **Category**: direction (requested feature)
- **Planned at**: commit `547101c`, 2026-09-01

## Why this matters

`/settings` renders 209 settable keys across 17 topics on one page with no
way to find one except scrolling or the browser's find. The operator asked
for components that filter through the names of settings. This plan adds a
search field above the list that narrows the page as you type, matching on
key, summary and topic, says how many of the total match, and keeps the query
in the URL so a reload or a shared link lands on the same view. Rows are not
re-rendered or unmounted by filtering — they are hidden — so an edit in
progress survives a change of query.

`DESIGN.md` (plan 020) says of a filterable table: "State the active filter
and selection rule ... Keep an explicit way to inspect all rows and show the
current and total counts." That is the count line and the Clear button.

## Current state

- `src/app/settings/page.tsx` (27 lines) — reads the `file` search param and
  renders `PageHeader` + `Suspense` + `SettingsList`:

```tsx
export default async function SettingsPage({
  searchParams,
}: PageProps<"/settings">) {
  const { file } = await searchParams;
  ...
        <SettingsList file={parseProjectFile(file)} />
```

- `src/components/settings/settings-list.tsx` (155 lines) — an async server
  component. Builds `topics` (`:50-59`), `uncatalogued` (`:61-66`), then
  renders: the "Settings files" section (`:70-90`), the file switch for a
  project (`:92`), one `<section>` per topic with a `<SettingRow>` per key
  (`:94-111`), and the Uncatalogued section (`:113-136`). Topic sections:

```tsx
{
  topics.map((topic) => (
    <section key={topic.topic} className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-gray-1000">{topic.topic}</h2>
      <div className="flex flex-col gap-2">
        {topic.settings.map(({ definition, effective }) => (
          <SettingRow
            key={definition.key}
            definition={definition}
            effective={effective}
            editing={editing}
            expected={expected}
            options={options}
            readOnly={"managed" in effective.perScope}
          />
        ))}
      </div>
    </section>
  ));
}
```

- `SettingRow` (`src/components/settings/setting-row.tsx`) is a `"use client"`
  component; a server component may pass `<SettingRow .../>` elements to a
  client component as props — that is how this plan keeps the rows
  server-composed while a client component decides which are shown.
- `src/lib/config/editing-scope.ts` — `parseProjectFile()` is the existing
  pattern for reading a search param defensively (`string | string[] | undefined`).
- URL state convention: "state lives in the URL" — `?file=local` on this page
  (`settings-file-switch.tsx`), `?item=` / `?archived=1` on the item pages
  (`master-detail.tsx:119-126`). Next.js 16 integrates
  `window.history.replaceState` with its router (docs:
  `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`,
  "Native History API"), so no `useRouter` is needed to update `?q=`.
- Form primitives: `Field` + `Input` (`src/components/ui/field.tsx`,
  `input.tsx`); a `Field` labels exactly one control. Buttons:
  `src/components/ui/button.tsx` (`variant="secondary" size="sm"`).
- Test conventions: `bun:test`, Testing Library, `userEvent`; jest-dom's
  `toBeVisible()` honours the `hidden` attribute.
- Copy rules (`DESIGN.md`): sentence case, no em dash, `…` not `...`.
  `CONTEXT.md`: the thing being found is a **setting**, not an option or
  preference.

## Commands you will need

| Purpose                            | Command                                                                                               | Expected on success              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------- |
| Route types (once, fresh worktree) | `bunx next typegen`                                                                                   | `✓ Types generated successfully` |
| Typecheck                          | `bun run typecheck`                                                                                   | exit 0                           |
| Lint                               | `bun run lint`                                                                                        | exit 0                           |
| Tests                              | `bun test`                                                                                            | `0 fail`                         |
| These tests                        | `bun test src/lib/config/setting-search.test.ts src/components/settings/filterable-settings.test.tsx` | all pass                         |
| Dev server                         | `bun dev`                                                                                             | http://127.0.0.1:3000/settings   |
| Format                             | `bunx prettier --check <touched files>`                                                               | exit 0                           |

## Scope

**In scope**:

- `src/lib/config/setting-search.ts` (create) and `setting-search.test.ts` (create)
- `src/components/settings/settings-filter.tsx` (create)
- `src/components/settings/filterable-settings.tsx` (create) and `filterable-settings.test.tsx` (create)
- `src/components/settings/settings-list.tsx`
- `src/app/settings/page.tsx`
- `plans/README.md` (status row; remove the "Find-as-you-type" direction candidate, step 6)

**Out of scope**:

- `src/components/settings/setting-row.tsx` and every control — untouched.
- A topic navigation / sticky index — not asked for; note it as a follow-up.
- Filtering on `/skills`, `/plugins`, `/mcp`, `/history` — not asked for.
- `next/navigation` hooks in the new components — they need the app router
  mounted and would make the components untestable under `bun test`; the
  initial query comes in as a prop and the URL is updated with the native
  History API.

## Git workflow

- Branch: `advisor/021-find-a-setting-by-name`, from `main`.
- Commit per step; imperative sentence, no prefix.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: The matcher, as a pure function

Create `src/lib/config/setting-search.ts`:

```ts
/** What a query is matched against. Summary and topic are absent for an uncatalogued key. */
export interface SearchableSetting {
  key: string;
  summary?: string;
  topic?: string;
}

/** Lower-cased, whitespace-split terms; an empty query has no terms and matches everything. */
export function queryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term !== "");
}

/**
 * True when every term appears somewhere in the key, summary or topic. Case does not
 * matter; a term may span a dot in the key (`defaultmode` finds `permissions.defaultMode`).
 */
export function matchesQuery(
  setting: SearchableSetting,
  terms: string[]
): boolean {
  if (terms.length === 0) return true;
  const haystack = [setting.key, setting.summary ?? "", setting.topic ?? ""]
    .join("\n")
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}
```

Create `setting-search.test.ts` covering: empty query matches; case-insensitive
key match; a term spanning the dot; a term found only in the summary; two
terms where one is in the key and the other in the topic; a term found in
none returns false; an uncatalogued entry (no summary/topic) matches on key only.

**Verify**: `bun test src/lib/config/setting-search.test.ts` → 7 pass.

### Step 2: The search field

Create `src/components/settings/settings-filter.tsx` (`"use client"`):

```tsx
export interface SettingsFilterProps {
  query: string;
  onQueryChange: (query: string) => void;
  /** How many settings the query matches, and how many there are in all. */
  shown: number;
  total: number;
}
```

Render a `Field` labelled `Find a setting` containing
`<Input type="search" name="q" value={query} onChange=... placeholder="Key, description or topic" autoComplete="off" spellCheck={false} />`,
then a line `<p role="status" className="text-sm text-gray-900">` reading
`{total} settings` when the query is empty, otherwise
`{shown} of {total} settings match`, and — only when the query is not
empty — a `<Button type="button" variant="secondary" size="sm" onClick={() => onQueryChange("")}>Clear</Button>`.
Put the status line and the button in one `flex items-center gap-4` row
under the field. No icon.

**Verify**: `bun run typecheck` → exit 0.

### Step 3: The client wrapper that shows and hides sections

Create `src/components/settings/filterable-settings.tsx` (`"use client"`):

```tsx
export interface FilterableRow {
  key: string;
  summary?: string;
  /** The server-rendered <SettingRow>. */
  node: ReactNode;
}
export interface FilterableTopic {
  topic: string;
  rows: FilterableRow[];
}
export interface FilterableSettingsProps {
  topics: FilterableTopic[];
  /** Keys on disk the catalog does not describe; empty when there are none. */
  uncatalogued: FilterableRow[];
  /** The `q` search param the page was requested with. */
  initialQuery: string;
}
```

Behaviour:

- `const [query, setQuery] = useState(initialQuery)`; `terms = queryTerms(query)`.
- For each topic, `visible = rows.filter((row) => matchesQuery({ key: row.key, summary: row.summary, topic }, terms))`.
  Render the section exactly as `settings-list.tsx` does today (same
  classes, same `<h2>`), with `hidden={visible.length === 0}` on the
  `<section>` and `hidden={!visibleKeys.has(row.key)}` on each row's
  wrapping `<div>`. Rows are always rendered; only visibility changes, so a
  row's form state survives filtering.
- The Uncatalogued section keeps its heading, count and explanatory
  paragraph from `settings-list.tsx:113-136`, filtered the same way with no
  summary or topic; the whole section is `hidden` when it has no visible row
  **or** when `uncatalogued.length === 0`.
- `shown` = visible rows across topics + uncatalogued; `total` = all rows.
- When `terms.length > 0 && shown === 0`, render
  `<p className="text-sm text-gray-900">No setting matches "{query}".</p>`
  below the filter.
- URL sync, debounced:

```tsx
useEffect(() => {
  const handle = setTimeout(() => {
    try {
      const url = new URL(window.location.href);
      if (query.trim() === "") url.searchParams.delete("q");
      else url.searchParams.set("q", query);
      window.history.replaceState(null, "", url);
    } catch {
      // Safari rate-limits history writes; the query still works, it is just not in the URL.
    }
  }, 300);
  return () => clearTimeout(handle);
}, [query]);
```

Other params (`file`) are preserved because the URL is built from the
current location.

Render order: `<SettingsFilter …/>`, then the topic sections, then the
Uncatalogued section, inside the same `flex flex-col gap-10` the list uses.

**Verify**: `bun run typecheck` → exit 0.

### Step 4: Compose it on the server

In `settings-list.tsx`:

- Add `initialQuery: string` to the props: `SettingsList({ file, initialQuery })`.
- Keep the "Settings files" section and `SettingsFileSwitch` where they are.
- Replace the topic sections and the Uncatalogued section with one
  `<FilterableSettings topics={…} uncatalogued={…} initialQuery={initialQuery} />`
  where each row's `node` is the exact `<SettingRow …/>` element rendered
  today (same props, including `key={definition.key}` on the element).
- Delete the now-unused `Badge` import if nothing else in the file uses it.

In `src/app/settings/page.tsx`: `const { file, q } = await searchParams;`
and pass `initialQuery={typeof q === "string" ? q : ""}`.

**Verify**: `bun run typecheck` 0 · `bun run lint` 0 · `bun test src/components/settings` all pass.
Manual: `bun dev`, open http://127.0.0.1:3000/settings, type `effort`: only
"Model and responses" remains with `effortLevel`; the line reads
`1 of 209 settings match` (the number of settable keys on your catalog);
the URL becomes `?q=effort` within a second; reload keeps the filter; Clear
restores everything; with a project selected, switching to
`?file=local` keeps `q` in the URL.

### Step 5: Wrapper tests

Create `filterable-settings.test.tsx`. Build two topics with rows whose
`node` is `<div data-testid={key}>{key}</div>` and one uncatalogued row:

1. `shows every row and the total when the query is empty` — every testid
   `toBeVisible()`; status text `4 settings`.
2. `hides rows and topics that do not match, and counts the rest` — type
   `verbose`; the matching row visible, the others `not.toBeVisible()`;
   the topic with no match is not visible; status `1 of 4 settings match`.
3. `matches on the summary and the topic, not only the key` — a term that
   appears only in a row's summary keeps that row visible.
4. `filters uncatalogued keys by name` — a term matching only the
   uncatalogued key leaves that section visible and the topics hidden.
5. `says when nothing matches and clears` — type `zzz`; text
   `No setting matches "zzz".`; click Clear; every row visible again.
6. `keeps the query in the URL` — type `verbose`; `await waitFor(() => expect(window.location.search).toBe("?q=verbose"))`;
   clear; `waitFor(... toBe(""))`.
7. `starts from the query in the URL` — `initialQuery="verbose"`: the field
   holds `verbose` and only that row is visible on first render.

**Verify**: `bun test src/components/settings/filterable-settings.test.tsx` → 7 pass.

### Step 6: Gates and index

Run all gates. Update this plan's row in `plans/README.md`, and under
"Direction candidates from the frontend audit" replace the "Find-as-you-type
on `/settings`" bullet with `Built by plan 021.`

**Verify**: `bun run typecheck` 0 · `bun run lint` 0 · `bun test` 0 fail · `bunx prettier --check` on touched files 0.

## Test plan

Steps 1 and 5. Pattern: `src/components/scope-switcher.test.tsx` for
`userEvent.type` + `waitFor`; `src/lib/config/editing-scope.test.ts` for a
pure-function test file.

## Done criteria

- [ ] `bun run typecheck`, `bun run lint`, `bun test` exit 0; 14 new tests pass
- [ ] `grep -n "FilterableSettings" src/components/settings/settings-list.tsx` matches
- [ ] `grep -n "useSearchParams\|useRouter" src/components/settings/filterable-settings.tsx src/components/settings/settings-filter.tsx` → no matches
- [ ] `grep -n '"q"' src/app/settings/page.tsx` or `const { file, q }` → matches
- [ ] Manual check in step 4 done and described in the commit message or the index row
- [ ] `git status --short` shows nothing outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

- `settings-list.tsx` no longer renders `<SettingRow>` inside per-topic
  `<section>` elements as excerpted.
- Passing `<SettingRow …/>` elements as props to the client wrapper fails
  the build or produces a serialisation error — report the exact message;
  do not convert `SettingRow` to a server component or move the catalog into
  the client bundle to work around it.
- jest-dom's `toBeVisible()` does not honour `hidden` under happy-dom —
  assert `toHaveAttribute("hidden")` instead and note the substitution.
- A step's verification fails twice.

## Maintenance notes

- Hiding rather than unmounting means all 209 rows stay in the DOM; plan
  024's notes and the index's "Found but not planned" carry the lazy-mount
  idea for the row body if `/settings` ever feels slow.
- A topic jump list (sticky, 17 entries) was considered and left out; it
  would sit above the filter and share `queryTerms`.
- Reviewer focus: that `hidden` is on the row wrapper and not on the
  `<details>` (a hidden `<details>` would lose its open state on some
  browsers), and that `?file=` survives a query change.
