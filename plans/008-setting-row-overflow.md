# Plan 008: A setting row stays inside its card however long its value or path is

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 69744da..HEAD -- src/components/settings/setting-row.tsx src/components/settings/settings-list.tsx src/components/settings/setting-row.test.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW — class-name changes and one `title` attribute; no data or behaviour changes.
- **Depends on**: none. Plan 006 also edits `setting-row.tsx` (it adds catalog detail and a
  confirmation) and plan 009 re-sizes its text; run 008 before both so their drift checks
  start from this layout.
- **Category**: bug (layout)
- **Planned at**: commit `69744da`, 2026-08-30

## Why this matters

`/settings` lists 217 catalogued keys as collapsible rows. Each collapsed row shows the key
on the left and the _effective value_ — `JSON.stringify(value)` — on the right, and the
right-hand span is `shrink-0`. For a scalar that is fine. For `permissions`, `hooks`,
`env`, `sandbox` or any string array, compact JSON is hundreds of characters with no
space to break at, so the span cannot shrink, cannot wrap, and pushes the key column to
nothing while overflowing the card. The expanded per-scope breakdown has the same
problem, and the "Settings files" list at the top puts an absolute path in a
`justify-between` row with no break opportunity either. These are the settings people
edit most (the design doc calls out `permissions` and `hooks` as "edited most"), so the
rows that matter are the rows that break. It happens at every viewport width; it is not
a mobile-only problem.

After this plan: a long value is truncated to one line with the full text on hover, the
breakdown wraps, the file paths wrap, and under 40rem (Tailwind `sm`) each row stacks
its value beneath its key instead of fighting for one line.

## Current state

- `src/components/settings/setting-row.tsx` — one setting: collapsed summary, per-scope
  breakdown, and the edit form. Client component.
- `src/components/settings/settings-list.tsx` — the server component that lists the
  settings files and every row.
- `src/lib/config/effective.ts:27-32` — the shape of the `effective` prop:

```ts
export interface EffectiveValue {
  key: string;
  effectiveValue: unknown;
  winningScope: Scope;
  perScope: Partial<Record<Scope, unknown>>;
}
```

- `src/components/settings/setting-row.tsx:31-33` — how a value is shown:

```tsx
function show(value: unknown): string {
  return value === undefined ? "Not set" : JSON.stringify(value);
}
```

- `src/components/settings/setting-row.tsx:50-70` — the collapsed row. Note `shrink-0` on
  line 63 and no `min-w-0`/`truncate` anywhere:

```tsx
    <details className="group rounded-base border border-gray-alpha-400 bg-background-100">
      <summary className="flex cursor-pointer items-baseline justify-between gap-4 px-4 py-3">
        <span className="flex flex-col gap-0.5">
          <span className="font-mono text-sm text-gray-1000">{key}</span>
          {definition ? (
            <span className="text-xs text-gray-900">{definition.summary}</span>
          ) : (
            <span className="text-xs text-gray-900">
              Not described by the catalog. Boopervisor leaves it as it found
              it.
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-xs text-gray-900">
            {show(effectiveValue)}
          </span>
          {isSet ? <Badge>{SCOPE_LABELS[winningScope]}</Badge> : null}
          {definition ? null : <Badge tone="warning">Uncatalogued</Badge>}
        </span>
      </summary>
```

- `src/components/settings/setting-row.tsx:73-91` — the per-scope breakdown:

```tsx
        <dl className="flex flex-col gap-1 text-xs">
          {(Object.keys(SCOPE_LABELS) as Scope[])
            .filter((scope) => scope in perScope)
            .map((scope) => (
              <div
                key={scope}
                className="flex items-baseline justify-between gap-4"
              >
                <dt
                  className={
                    scope === winningScope ? "text-gray-1000" : "text-gray-900"
                  }
                >
                  {SCOPE_LABELS[scope]}
                  {scope === winningScope ? " — wins" : null}
                </dt>
                <dd className="font-mono text-gray-1000">
                  {show(perScope[scope])}
                </dd>
              </div>
            ))}
```

- `src/components/settings/settings-list.tsx:67-84` — the files list:

```tsx
<section className="flex flex-col gap-2">
  <h2 className="text-sm font-medium text-gray-1000">Settings files</h2>
  <ul className="flex flex-col gap-1 text-xs">
    {fileStatuses.map((status) => (
      <li
        key={status.path}
        className="flex items-baseline justify-between gap-4"
      >
        <span className="text-gray-900">
          {SCOPE_LABELS[status.scope]}
          <span className="ml-2 font-mono text-gray-800">{status.path}</span>
        </span>
        <span className="text-gray-900">{FILE_STATES[status.state]}</span>
      </li>
    ))}
  </ul>
</section>
```

- Conventions. Tailwind 4.3 with the Geist token layer in `src/app/globals.css`; colour
  classes must be tokens (`text-gray-900`, `bg-background-100` — never `gray-50` or
  `zinc-*`). Breakpoints are Tailwind defaults: `sm` = 40rem, `md` = 48rem. The `Badge`
  component (`src/components/ui/badge.tsx`) accepts `className`. `cn()` from `@/lib/cn`
  merges class names. Do not change the `text-xs` / `text-sm` sizes in this plan — plan
  009 owns type sizes and will change them by content, not line number.
- Test conventions: `bun test`, colocated `*.test.tsx`, `@testing-library/react` with
  happy-dom, sentence-style test names. `src/components/scope-switcher.test.tsx` already
  renders a component that imports a `"use server"` action module, so importing
  `setting-row.tsx` (which imports `@/lib/config/actions`) in a test works.

## Commands you will need

| Purpose    | Command                                            | Expected on success |
| ---------- | -------------------------------------------------- | ------------------- |
| Install    | `bun install`                                      | exit 0              |
| Typecheck  | `bun run typecheck`                                | exit 0, no errors   |
| Lint       | `bun run lint`                                     | exit 0              |
| Tests      | `bun test src/components`                          | all pass            |
| Format     | `bunx prettier --check <files you changed>`        | exit 0              |
| Dev server | `bun dev` then open http://localhost:3000/settings | page renders        |

Do not run a bare `bun test` unless plan 002 is DONE in `plans/README.md`: before 002,
some library tests write into the real `~/.claude`.

## Suggested executor toolkit

- `AGENTS.md` asks you to read `node_modules/next/dist/docs/` before writing code. This
  plan touches no Next API; nothing to read beyond that note.

## Scope

**In scope** (the only files you should modify):

- `src/components/settings/setting-row.tsx` — the `<summary>` (lines 51–70) and the `<dl>` (lines 73–91) only
- `src/components/settings/settings-list.tsx` — the files `<ul>` (lines 69–83) only
- `src/components/settings/setting-row.test.tsx` (create)

**Out of scope** (do NOT touch, even though they look related):

- `show()` — do not summarise objects ("3 rules") or pretty-print; the row shows what is
  in the file, and plan 006 is where catalog-aware display lives.
- The edit form below the breakdown (`<form action={submit}>` onwards) — untouched.
- `text-xs` → `text-sm` changes — plan 009.
- `text-gray-800` on the path — plan 009 (contrast).
- `src/components/settings/settings-list.tsx` outside the files list — plan 005 adds a
  file switch there.

## Git workflow

- Branch: `advisor/008-setting-row-overflow`
- Commit message style: capitalised imperative sentence, no prefix, e.g.
  `Keep a setting row inside its card however long the value is`.
- Run `bunx prettier --write` on touched files before committing (the pre-commit hook
  would do it anyway; doing it first keeps the diff you reviewed).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the failing test

Create `src/components/settings/setting-row.test.tsx`:

```tsx
import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";

import { SettingRow } from "./setting-row";

/** Compact JSON with no space to break at, as `permissions` looks in a real file. */
const LONG_VALUE = {
  allow: Array.from(
    { length: 12 },
    (_, i) => `Bash(git ${"subcommand".repeat(i + 1)}:*)`
  ),
};

function renderRow() {
  return render(
    <SettingRow
      effective={{
        key: "permissions",
        effectiveValue: LONG_VALUE,
        winningScope: "user",
        perScope: { user: LONG_VALUE },
      }}
      editing="user"
      expected="not-a-real-snapshot"
      readOnly={false}
    />
  );
}

describe("SettingRow", () => {
  test("keeps a long effective value to one line, with the whole value on hover", () => {
    renderRow();
    const summaryValue = screen.getAllByTitle(JSON.stringify(LONG_VALUE))[0];
    expect(summaryValue).toHaveClass("truncate");
    expect(summaryValue).toHaveClass("min-w-0");
  });

  test("lets a value in the breakdown break anywhere", () => {
    renderRow();
    const breakdownValue = screen.getByText(JSON.stringify(LONG_VALUE), {
      selector: "dd",
    });
    expect(breakdownValue).toHaveClass("break-all");
  });
});
```

`definition` is omitted on purpose: an uncatalogued row exercises the same summary and
breakdown without depending on the catalog's contents.

**Verify**: `bun test src/components/settings/setting-row.test.tsx` → 2 fail (no element
with that `title`; `dd` lacks `break-all`). If it fails to _render_ at all (an import
error rather than an assertion failure), STOP.

### Step 2: Let the summary shrink, truncate, and stack

In `src/components/settings/setting-row.tsx`, replace lines 51–70 (the whole
`<summary>…</summary>`) with:

```tsx
<summary className="flex cursor-pointer flex-col gap-2 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
  <span className="flex min-w-0 flex-col gap-0.5">
    <span className="font-mono text-sm text-gray-1000">{key}</span>
    {definition ? (
      <span className="text-xs text-gray-900">{definition.summary}</span>
    ) : (
      <span className="text-xs text-gray-900">
        Not described by the catalog. Boopervisor leaves it as it found it.
      </span>
    )}
  </span>
  <span className="flex min-w-0 items-center gap-2 sm:max-w-[50%] sm:shrink">
    <span
      className="min-w-0 truncate font-mono text-xs text-gray-900"
      title={show(effectiveValue)}
    >
      {show(effectiveValue)}
    </span>
    {isSet ? (
      <Badge className="shrink-0">{SCOPE_LABELS[winningScope]}</Badge>
    ) : null}
    {definition ? null : (
      <Badge tone="warning" className="shrink-0">
        Uncatalogued
      </Badge>
    )}
  </span>
</summary>
```

What changed and why: the summary stacks (`flex-col`) below `sm` and becomes a row above
it; both children get `min-w-0` so flex lets them shrink; the value span is `truncate`
(one line, ellipsis) with the full text in `title`; badges are `shrink-0` so the value is
what gives way, never the badge.

**Verify**: `bun test src/components/settings/setting-row.test.tsx` → 1 pass, 1 fail (the `dd` test).

### Step 3: Let the breakdown wrap

Still in `setting-row.tsx`, in the `<dl>` block: change the per-scope `<div>`'s class from
`"flex items-baseline justify-between gap-4"` to
`"flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"`, and
the `<dd>`'s class from `"font-mono text-gray-1000"` to
`"min-w-0 break-all font-mono text-gray-1000"`.

**Verify**: `bun test src/components/settings/setting-row.test.tsx` → 2 pass.

### Step 4: Let the file paths wrap

In `src/components/settings/settings-list.tsx`, in the files `<ul>`:

- the `<li>` class `"flex items-baseline justify-between gap-4"` →
  `"flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"`
- the outer `<span className="text-gray-900">` → `<span className="min-w-0 text-gray-900">`
- the path `<span className="ml-2 font-mono text-gray-800">` →
  `<span className="ml-2 break-all font-mono text-gray-800">` (keep `text-gray-800`; plan 009 changes it)
- the state `<span className="text-gray-900">` → `<span className="shrink-0 text-gray-900">`

**Verify**: `grep -c "break-all" src/components/settings/settings-list.tsx` → `1`.

### Step 5: Look at it

Run `bun dev`, open http://localhost:3000/settings. With the user scope selected and a
`permissions` key set in `~/.claude/settings.json` (if none is set, add a value to any
string-array setting through the form, then Unset it afterwards — this writes a backup
and a History entry, which is the product working as designed):

- The `permissions` row's value ends in "…" and does not push the card wider than the
  page. In the browser console: `document.documentElement.scrollWidth <= window.innerWidth`
  → `true`.
- Expand the row: the breakdown value wraps over several lines inside the card.
- Narrow the window below 640px (DevTools device toolbar, or just drag): the value sits
  under the key; the "Settings files" paths wrap.

**Verify**: the console expression above → `true` at both 1280px and 375px width.

### Step 6: Full gate

**Verify**: `bun run typecheck` → exit 0.
**Verify**: `bun run lint` → exit 0.
**Verify**: `bun test src/components` → all pass (88 existing + 2 new).
**Verify**: `bunx prettier --check src/components/settings/setting-row.tsx src/components/settings/settings-list.tsx src/components/settings/setting-row.test.tsx` → exit 0.

## Test plan

- New `src/components/settings/setting-row.test.tsx` with the two tests in Step 1:
  the summary value is truncated with a `title`, and the breakdown value can break.
- Pattern: `src/components/items/master-detail.test.tsx` (render a component with fixed
  props, assert on roles/attributes) and `src/components/ui/button.test.tsx` (assert on
  class names where layout is the behaviour).
- Verification: `bun test src/components/settings/setting-row.test.tsx` → 2 pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun test src/components` exits 0; `setting-row.test.tsx` exists with 2 passing tests
- [ ] `grep -n "shrink-0 items-center" src/components/settings/setting-row.tsx` → no output (the old summary span is gone)
- [ ] `grep -c "break-all" src/components/settings/setting-row.tsx` → `1`
- [ ] `grep -c "break-all" src/components/settings/settings-list.tsx` → `1`
- [ ] `git status --short` shows only the three in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `<summary>` in `setting-row.tsx` does not match the excerpt above (plan 006 or 009
  has landed first). Report which; the reviewer will re-order.
- The Step 1 test fails with an import or render error rather than an assertion failure —
  importing the server-action module under bun test has stopped working, and that is a
  test-infrastructure question, not yours.
- `Badge` no longer accepts `className` (check `src/components/ui/badge.tsx`).
- Fixing the overflow seems to need a change to `show()` or to the form below.

## Maintenance notes

- Plan 006 will add catalog detail to this row; whoever does it should keep the
  `min-w-0` on both summary children — it is what lets flex shrink text, and dropping it
  reintroduces the overflow.
- Plan 009 changes `text-xs` to `text-sm` on these lines; it locates them by content.
- Reviewer: check that the `title` attribute is the _full_ JSON (it is the only place the
  collapsed value is readable in full), and that badges never truncate.
- Deferred: at 72rem the key sits at the far left and the value at the far right of a
  row; scanning a long list means a long eye travel. A narrower list (`max-w-4xl`) or a
  value beside the key is a design choice recorded as a direction candidate in
  `plans/README.md`, not part of this plan.
