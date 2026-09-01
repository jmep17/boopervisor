# Plan 010: The shell and the master-detail layout work at any window width

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 69744da..HEAD -- src/app/layout.tsx src/components/app-header.tsx src/components/page-header.tsx src/components/scope-switcher.tsx src/components/items/master-detail.tsx src/components/items/master-detail.test.tsx src/app/settings/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (`master-detail.tsx:75,90` and
> `page-header.tsx` may carry `text-sm` instead of `text-xs` if plan 009 ran first —
> that alone is not drift.)

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW — additive responsive variants; desktop layout above 48rem is unchanged
  except for the header's ability to wrap.
- **Depends on**: none. Coordinates with plan 005, which rewrites `src/app/settings/page.tsx`
  to read search params: whichever lands second re-applies the other's change to that file
  (this plan's change there is two lines).
- **Category**: tech-debt (responsive layout)
- **Planned at**: commit `69744da`, 2026-08-30

## Why this matters

There is not one responsive variant (`sm:`, `md:`, `lg:`, `max-*:`) in the codebase.
Three layouts assume a wide window:

- The header is a fixed `h-16` row: brand + five nav links + a `w-56` scope select with
  `gap-6`. That needs roughly 700px; narrower than that it overflows sideways and the
  page gets a horizontal scrollbar.
- `/skills`, `/plugins` and `/mcp` use `grid-cols-[16rem_1fr]`. At 375px the list takes
  256px and the detail column gets what is left — about 90px — with the JSON blocks and
  the three state buttons squeezed into it.
- The page header is a non-wrapping `justify-between` row.

Boopervisor is a local tool, and the realistic narrow case is not a phone but a browser
window docked beside a terminal or an editor at half a laptop screen (600–800px). Today
that layout is broken. Two smaller inconsistencies live in the same files: `/settings`
wraps its content in an extra `p-6` that no other page has, and its loading fallback is
an unstyled `<div>Loading settings...</div>` while every other page uses a styled
`<p>` with a real ellipsis.

After this plan: the header wraps onto two rows below 40rem with the scope select
full-width; the master-detail grid is one column below 48rem, showing the list _or_ the
selected item with a way back; the page header stacks; `/settings` matches its siblings.

## Current state

- `src/app/layout.tsx:29`:

```tsx
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
```

- `src/components/app-header.tsx:23-40` — the nav — and `:52-64` — the header:

```tsx
export function AppHeaderNav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Sections" className="flex items-center gap-1">
```

```tsx
export function AppHeader({ scopeSwitcher }: { scopeSwitcher?: ReactNode }) {
  const pathname = usePathname();
  return (
    <header className="border-b border-gray-400 bg-background-100">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-6">
        <Link
          href="/settings"
          className="text-sm font-semibold tracking-tight text-gray-1000"
        >
          Boopervisor
        </Link>
        <AppHeaderNav pathname={pathname} />
        <div className="ml-auto">{scopeSwitcher}</div>
      </div>
    </header>
  );
}
```

- `src/components/scope-switcher.tsx:51-61` — the select's fixed width — and `:142-151`
  — the wrapper:

```tsx
    <Select
      aria-label="Scope"
      value={encodeScope(selected)}
      valueLabel={scopeLabel(selected)}
      disabled={pending}
      onValueChange={(value) =>
        value === ADD_PROJECT_VALUE ? onAddProject() : onSelect(value)
      }
      className="w-56"
    >
```

```tsx
  return (
    <div className="flex items-center gap-2">
      <ScopeSwitcherView
```

- `src/components/page-header.tsx:12-20`:

```tsx
return (
  <div className="flex items-start justify-between gap-6 pb-6">
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-1000">
        {title}
      </h1>
      <p className="max-w-prose text-sm text-gray-900">{description}</p>
    </div>
    {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
  </div>
);
```

(No page passes `actions` today; `grep -rn "actions=" src` is empty.)

- `src/components/items/master-detail.tsx:51-100` — the grid, list, archived toggle and
  detail slot:

```tsx
  return (
    <div className="grid grid-cols-[16rem_1fr] gap-6">
      <div className="flex flex-col gap-2">
        <ul className="flex flex-col gap-1">
          {visible.map((item) => (
            …
          ))}
          {visible.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-900">{empty}</li>
          ) : null}
        </ul>

        {archivedCount > 0 || showArchived ? (
          <Link
            href={itemHref(selectedId, !showArchived)}
            className="px-3 text-xs text-gray-900 underline-offset-2 hover:underline"
          >
            {showArchived
              ? "Hide archived"
              : `Show archived (${archivedCount})`}
          </Link>
        ) : null}
      </div>

      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Selection and the archived filter are both query parameters of the page itself. */
function itemHref(id: string | undefined, showArchived: boolean): string {
  const params = new URLSearchParams();
  if (id) params.set("item", id);
  if (showArchived) params.set("archived", "1");
  const query = params.toString();
  return query ? `?${query}` : "?";
}
```

`cn` and `Link` are already imported in this file. The callers
(`src/app/skills/skill-list.tsx`, `src/app/mcp/mcp-server-list.tsx`,
`src/app/plugins/plugin-list.tsx`) pass `selectedId` from the `?item=` search param and
render "Select a skill." (etc.) as `children` when nothing is selected.

- `src/app/settings/page.tsx:5-19`:

```tsx
export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Every documented Claude Code setting, its effective value, and the scope that won."
      />
      <div className="p-6">
        <Suspense fallback={<div>Loading settings...</div>}>
          <SettingsList />
        </Suspense>
      </div>
    </>
  );
}
```

For comparison, `src/app/skills/page.tsx:18-20`:

```tsx
      <Suspense
        fallback={<p className="text-sm text-gray-900">Reading skills…</p>}
      >
```

- Existing test: `src/components/items/master-detail.test.tsx` renders `MasterDetail`
  with three fixed items via a `renderList(props)` helper and asserts on links by role
  and `href` (e.g. `"?item=alpha&archived=1"`). Model new tests on it.

- `docs/PLAN.md` "Interface": "Master-detail within `/skills`, `/plugins` and `/mcp`:
  item list on the left, detail and state controls on the right." and "Selection and the
  archived filter live in the URL, so both survive a reload and neither needs client
  state." This plan keeps both: the narrow layout is CSS only; the back link is a plain
  `href` that drops `item` and keeps `archived`.

- Conventions: Tailwind 4.3, Geist tokens only (plan 007's test enforces). Breakpoints:
  `sm` 40rem, `md` 48rem, `lg` 64rem; `max-sm:` / `max-md:` apply _below_ a breakpoint.
  `cn()` from `@/lib/cn`.

## Commands you will need

| Purpose    | Command                                     | Expected on success |
| ---------- | ------------------------------------------- | ------------------- |
| Install    | `bun install`                               | exit 0              |
| Typecheck  | `bun run typecheck`                         | exit 0              |
| Lint       | `bun run lint`                              | exit 0              |
| Tests      | `bun test src/components`                   | all pass            |
| Format     | `bunx prettier --check <files you changed>` | exit 0              |
| Dev server | `bun dev` → http://localhost:3000           | renders             |

Do not run a bare `bun test` unless plan 002 is DONE in `plans/README.md`. Until plan
003 is DONE, `bun dev` listens on all interfaces, not only localhost — a local check is
fine; do not leave it running.

## Suggested executor toolkit

- `AGENTS.md`: read `node_modules/next/dist/docs/` before writing code. Relevant here:
  `01-app/03-api-reference/02-components/link.md` (the `Link` component; `href="?"` with
  only a query is already used in this file).
- The viewport meta tag is set by Next automatically
  (`01-app/03-api-reference/04-functions/generate-viewport.md`: "The `viewport` meta tag
  is automatically set"); do not add one.

## Scope

**In scope** (the only files you should modify):

- `src/app/layout.tsx` — the `<main>` class only
- `src/components/app-header.tsx`
- `src/components/page-header.tsx`
- `src/components/scope-switcher.tsx` — two class strings only
- `src/components/items/master-detail.tsx`
- `src/components/items/master-detail.test.tsx`
- `src/app/settings/page.tsx`

**Out of scope** (do NOT touch, even though they look related):

- `src/app/skills/skill-list.tsx`, `mcp-server-list.tsx`, `plugin-list.tsx` — they get the
  narrow layout through `MasterDetail`; nothing to change.
- `src/components/settings/**` — plans 005, 006, 008, 009.
- `src/components/ui/dialog.tsx`, `select.tsx` — plan 011.
- Text sizes and colours — plan 009.
- A mobile "hamburger" menu — five short links wrap fine; do not add menu state.

## Git workflow

- Branch: `advisor/010-responsive-shell`
- Commits per step are fine. Style: capitalised imperative sentence, no prefix, e.g.
  `Let the header wrap and the item list collapse on a narrow window`.
- `bunx prettier --write` on touched files before committing.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Master-detail — failing test first

In `src/components/items/master-detail.test.tsx`, add inside `describe("MasterDetail")`:

```tsx
test("offers a way back to the list when an item is selected, keeping the archived filter", () => {
  renderList({ selectedId: "beta", showArchived: true });
  expect(screen.getByRole("link", { name: "All items" })).toHaveAttribute(
    "href",
    "?archived=1"
  );
});

test("offers no way back when nothing is selected", () => {
  renderList();
  expect(screen.queryByRole("link", { name: "All items" })).toBeNull();
});
```

**Verify**: `bun test src/components/items/master-detail.test.tsx` → 1 new fail, 1 new pass.

### Step 2: Master-detail — one column below `md`, list or detail

In `src/components/items/master-detail.tsx`, replace the `return (…)` block shown in
"Current state" with:

```tsx
return (
  <div className="grid grid-cols-1 gap-6 md:grid-cols-[16rem_1fr]">
    <div className={cn("flex flex-col gap-2", selectedId && "max-md:hidden")}>
      <ul className="flex flex-col gap-1">
        {visible.map((item) => (
          <li key={item.id}>
            <Link
              href={itemHref(item.id, showArchived)}
              aria-current={item.id === selectedId ? "true" : undefined}
              className={cn(
                "flex flex-col gap-0.5 rounded-base px-3 py-2 text-sm",
                "hover:bg-gray-alpha-100",
                item.id === selectedId
                  ? "bg-gray-alpha-200 text-gray-1000"
                  : "text-gray-900"
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate">{item.label}</span>
                {STATE_TONE[item.state] ? (
                  <Badge tone={STATE_TONE[item.state]}>{item.state}</Badge>
                ) : null}
              </span>
              {item.detail ? (
                <span className="truncate text-xs text-gray-800">
                  {item.detail}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
        {visible.length === 0 ? (
          <li className="px-3 py-2 text-sm text-gray-900">{empty}</li>
        ) : null}
      </ul>

      {archivedCount > 0 || showArchived ? (
        <Link
          href={itemHref(selectedId, !showArchived)}
          className="px-3 text-xs text-gray-900 underline-offset-2 hover:underline"
        >
          {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
        </Link>
      ) : null}
    </div>

    <div
      className={cn(
        "flex min-w-0 flex-col gap-4",
        !selectedId && "max-md:hidden"
      )}
    >
      {selectedId ? (
        <Link
          href={itemHref(undefined, showArchived)}
          className="w-fit text-sm text-gray-900 underline-offset-2 hover:underline md:hidden"
        >
          All items
        </Link>
      ) : null}
      {children}
    </div>
  </div>
);
```

Only four things changed from the excerpt: the grid classes; `max-md:hidden` on the list
when something is selected; the detail wrapper gained `flex flex-col gap-4` and
`max-md:hidden` when nothing is selected; and the "All items" link, shown only below
`md`. If plan 009 already ran, keep its `text-sm` on the detail line and the archived
link rather than re-introducing `text-xs` — copy the classes from the live file for
those two spans.

**Verify**: `bun test src/components/items/master-detail.test.tsx` → all pass (7 existing + 2 new).

### Step 3: Header wraps; scope select goes full-width below `sm`

In `src/components/app-header.tsx`:

- nav (line 25): `"flex items-center gap-1"` → `"flex items-center gap-1 overflow-x-auto"`
- header row (line 54): `"mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-6"` →
  `"mx-auto flex min-h-16 w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:px-6"`
- scope slot (line 62): `<div className="ml-auto">` →
  `<div className="ml-auto max-sm:order-last max-sm:ml-0 max-sm:w-full">`

In `src/components/scope-switcher.tsx`:

- the `Select`'s `className="w-56"` → `className="w-full sm:w-56"`
- the wrapper `<div className="flex items-center gap-2">` (in `ScopeSwitcher`, not the
  form) → `<div className="flex w-full items-center gap-2 sm:w-auto">`

**Verify**: `grep -c "flex-wrap" src/components/app-header.tsx` → `1`.
**Verify**: `grep -c "sm:w-56" src/components/scope-switcher.tsx` → `1`.
**Verify**: `bun test src/components/app-header.test.tsx src/components/scope-switcher.test.tsx` → all pass. If a scope-switcher test asserts the literal class `w-56`, update that assertion to `sm:w-56` and say so in your report.

### Step 4: Page header stacks; main padding tightens below `sm`

`src/components/page-header.tsx` line 13:
`"flex items-start justify-between gap-6 pb-6"` →
`"flex flex-col gap-4 pb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6"`;
and the actions wrapper `"flex items-center gap-2"` → `"flex flex-wrap items-center gap-2"`.

`src/app/layout.tsx` line 29: `"mx-auto w-full max-w-6xl flex-1 px-6 py-8"` →
`"mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8"`.

**Verify**: `grep -c "sm:flex-row" src/components/page-header.tsx` → `1`.
**Verify**: `grep -c "sm:px-6" src/app/layout.tsx` → `1`.

### Step 5: `/settings` matches its siblings

In `src/app/settings/page.tsx`, remove the `<div className="p-6">` wrapper (and its
closing tag) and change the fallback so the block reads:

```tsx
<Suspense fallback={<p className="text-sm text-gray-900">Reading settings…</p>}>
  <SettingsList />
</Suspense>
```

**Verify**: `grep -c 'p-6\|Loading settings' src/app/settings/page.tsx` → `0`.

### Step 6: Look at it

`bun dev`; open http://localhost:3000/skills; open DevTools, toggle the device toolbar,
set the width to 375px, then 700px, then 1280px. At each width run in the console:
`document.documentElement.scrollWidth <= window.innerWidth`.

- 375px: header on two rows, scope select full-width; the skill list alone; click a skill
  → the detail alone with "All items" above it; "All items" returns to the list.
- 700px: header on one or two rows, no sideways scroll; list beside detail (700px > 48rem
  = 768px? no — 700px is _below_ `md`, so still one column; at 800px two columns).
- 1280px: unchanged from before this plan, apart from `/settings` no longer being
  indented by an extra 24px.

Repeat the console check on `/settings` and `/history` at 375px. Stop the dev server.

**Verify**: the console expression → `true` at every width on `/skills`, `/settings`, `/history`.

### Step 7: Full gate

**Verify**: `bun run typecheck` → exit 0.
**Verify**: `bun run lint` → exit 0.
**Verify**: `bun test src/components` → all pass.
**Verify**: `bunx prettier --check` on every file you changed → exit 0.

## Test plan

- New tests in `src/components/items/master-detail.test.tsx` (Step 1): the back link
  exists with the right `href` when an item is selected; absent otherwise.
- Header/page-header/layout changes are class-only and are verified by grep and the
  manual pass; happy-dom does not lay out.
- Existing tests unchanged, except possibly a `w-56` assertion in
  `scope-switcher.test.tsx` (see Step 3).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun test src/components` exits 0, with the 2 new master-detail tests passing
- [ ] `grep -rn "grid-cols-\[16rem_1fr\]" src` → only `md:grid-cols-[16rem_1fr]` in `master-detail.tsx`
- [ ] `grep -c '"mx-auto flex h-16' src/components/app-header.tsx` → `0`
- [ ] `grep -c "Loading settings" src/app/settings/page.tsx` → `0`
- [ ] `grep -rnoE "\b(sm|md|max-sm|max-md):[a-z0-9\[\]_./-]+" src --include="*.tsx" | grep -v test | wc -l` → at least `12`
- [ ] `git status --short` lists only in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `src/app/settings/page.tsx` no longer matches the excerpt (plan 005 landed first). Apply
  only the two-line change — drop the `p-6` wrapper if it still exists and restyle the
  fallback — and note it; if the file has no `p-6` wrapper and a styled fallback already,
  skip Step 5 entirely.
- `MasterDetail`'s signature or `itemHref` has changed.
- Making the header fit needs anything beyond wrapping (a menu, hiding links) — that is a
  design decision, not this plan.
- The Step 6 console check is `false` at 375px on any page after your changes: report
  which element overflows (`[...document.querySelectorAll("*")].filter(e => e.scrollWidth > document.documentElement.clientWidth)`), do not patch it ad hoc.

## Maintenance notes

- The narrow master-detail is CSS-only: both columns are always rendered; `max-md:hidden`
  chooses which is visible. If a future change wants to skip rendering the hidden column,
  it must not break the "selection lives in the URL" rule from `docs/PLAN.md`.
- `AppHeaderNav` scrolls sideways (`overflow-x-auto`) as the last resort under 40rem when
  even wrapped links do not fit; if a sixth section is added, check the header at 375px.
- Reviewer: at 800–900px the header may sit on two rows because the scope select is
  `w-56` and the nav is five links; that is intended. Check dark mode once — nothing here
  changes colours, but the wrapped header row shows more `border-gray-400`.
