# Plan 011: A dialog and a dropdown always fit inside the window

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 69744da..HEAD -- src/components/ui/dialog.tsx src/components/ui/dialog.test.tsx src/components/ui/select.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW — class-name changes on two primitives; Radix behaviour untouched.
- **Depends on**: none (plan 007's token test, if present, must stay green — nothing here
  adds a colour class)
- **Category**: tech-debt (responsive layout)
- **Planned at**: commit `69744da`, 2026-08-30

## Why this matters

`DialogContent` is `fixed … w-full max-w-lg` centred by translate, with no inset from the
window edge and no height limit. Under 32rem (512px) of width it runs edge to edge; when
its content is taller than the window — a short window, or a large text size, both of
which plan 009 makes more likely by design — the footer buttons ("Add project",
"Restore") sit below the fold with no way to scroll to them. The Select popover caps
its height at a fixed `max-h-64` (16rem) rather than the space Radix says is actually
available, so near the bottom of a short window it can be clipped, and it has no
width cap for a long project path in a scope option.

After this plan: a dialog keeps 1rem of window on every side, scrolls inside itself
when taller than the window, and pads less on a narrow window; a select popover is no
taller than the space available and no wider than the window.

## Current state

- `src/components/ui/dialog.tsx:19-31` — overlay and content:

```tsx
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="fixed inset-0 z-50 bg-gray-alpha-500"
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
          "flex flex-col gap-4 rounded-medium bg-background-100 p-6 shadow-modal outline-none",
          className,
        )}
        {...props}
      >
```

The close button inside it is `absolute right-4 top-4` (line 35) and stays where it is.

- `src/components/ui/select.tsx:61-71` — the popover:

```tsx
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          data-slot="select-content"
          position="popper"
          sideOffset={4}
          className={cn(
            "relative z-50 max-h-64 min-w-[var(--radix-select-trigger-width)] overflow-hidden",
            "rounded-medium bg-background-100 p-1 shadow-menu"
          )}
        >
```

Radix Select in `position="popper"` mode sets `--radix-select-content-available-height`
on the content element (confirmed present in
`node_modules/@radix-ui/react-select/dist/index.mjs` at `@radix-ui/react-select` 2.3.x).

- `src/components/ui/dialog.test.tsx` — two tests: closed dialog shows only its trigger;
  open dialog has an accessible name and description, via a `ConfirmDialog` helper.
  Model the new test on it. `button.test.tsx:24` shows the convention for asserting a
  class name when layout _is_ the behaviour: `expect(link.className).toContain("rounded-base")`.

- Dialog users: `src/components/scope-switcher.tsx` (Add a project) and
  `src/components/history/history-row.tsx` (Restore backup?). Neither passes `className`
  to `DialogContent`; they need no change.

- Conventions: Tailwind 4.3, arbitrary values in brackets (`max-h-[calc(100dvh-2rem)]`),
  Geist tokens only for colours. `sm` breakpoint = 40rem.

## Commands you will need

| Purpose    | Command                                                                                                             | Expected on success |
| ---------- | ------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Install    | `bun install`                                                                                                       | exit 0              |
| Typecheck  | `bun run typecheck`                                                                                                 | exit 0              |
| Lint       | `bun run lint`                                                                                                      | exit 0              |
| Tests      | `bun test src/components/ui`                                                                                        | all pass            |
| Format     | `bunx prettier --check src/components/ui/dialog.tsx src/components/ui/dialog.test.tsx src/components/ui/select.tsx` | exit 0              |
| Dev server | `bun dev` → http://localhost:3000                                                                                   | renders             |

Do not run a bare `bun test` unless plan 002 is DONE in `plans/README.md`.

## Suggested executor toolkit

- `AGENTS.md`: read `node_modules/next/dist/docs/` before writing code. No Next API is
  involved here.
- Radix Select CSS variables: `--radix-select-content-available-height`,
  `--radix-select-trigger-width` (the latter is already used on line 67).

## Scope

**In scope** (the only files you should modify):

- `src/components/ui/dialog.tsx` — the `DialogPrimitive.Content` class string only
- `src/components/ui/dialog.test.tsx` — add one test
- `src/components/ui/select.tsx` — the `SelectPrimitive.Content` class string only

**Out of scope** (do NOT touch, even though they look related):

- The overlay, close button, `DialogTitle`, `DialogDescription`, `DialogFooter`.
- `SelectItem`, the trigger, `useFieldControl` plumbing.
- The dialog _callers_ in `scope-switcher.tsx` and `history-row.tsx`.
- Turning the dialog into a bottom sheet on narrow windows — not asked for.

## Git workflow

- Branch: `advisor/011-dialog-and-select-fit-the-viewport`
- One commit: `Keep dialogs and dropdowns inside the window`. Style: capitalised
  imperative sentence, no prefix.
- `bunx prettier --write` on touched files before committing.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Failing test

In `src/components/ui/dialog.test.tsx`, add inside `describe("Dialog")`:

```tsx
test("keeps itself inside the window and scrolls when taller than it", () => {
  render(<ConfirmDialog open />);
  const className = screen.getByRole("dialog").className;
  expect(className).toContain("max-h-[calc(100dvh-2rem)]");
  expect(className).toContain("overflow-y-auto");
  expect(className).toContain("w-[calc(100%-2rem)]");
});
```

**Verify**: `bun test src/components/ui/dialog.test.tsx` → 2 pass, 1 fail.

### Step 2: Dialog content

In `src/components/ui/dialog.tsx`, replace the two class strings inside `cn(` on the
`DialogPrimitive.Content` with three:

```tsx
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2",
          "max-h-[calc(100dvh-2rem)] overflow-y-auto",
          "flex flex-col gap-4 rounded-medium bg-background-100 p-4 shadow-modal outline-none sm:p-6",
          className,
        )}
```

What changed: `w-full` → `w-[calc(100%-2rem)]` (1rem of window each side);
`max-h-[calc(100dvh-2rem)] overflow-y-auto` (never taller than the window, scrolls
inside); `p-6` → `p-4 sm:p-6`.

**Verify**: `bun test src/components/ui/dialog.test.tsx` → 3 pass.

### Step 3: Select popover

In `src/components/ui/select.tsx`, change the first class string on
`SelectPrimitive.Content` from

```
"relative z-50 max-h-64 min-w-[var(--radix-select-trigger-width)] overflow-hidden",
```

to

```
"relative z-50 max-h-[min(16rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-1rem)] overflow-hidden",
```

Also make the viewport scroll: the `<SelectPrimitive.Viewport>` on line 70 has no class;
give it `className="overflow-y-auto"` so a capped list can be scrolled. (Radix's
Viewport already sets `overflow: auto` inline via its own style in popper mode; the
class is belt and braces and harmless.)

**Verify**: `grep -c "radix-select-content-available-height" src/components/ui/select.tsx` → `1`.
**Verify**: `grep -c "max-h-64" src/components/ui/select.tsx` → `0`.
**Verify**: `bun test src/components/ui/select.test.tsx` → all pass.

### Step 4: Look at it

`bun dev`; open http://localhost:3000/settings.

- Open the scope select in the header: it drops down as before. Resize the window to
  ~400px tall and open it again: the list is shorter than the window and scrolls.
- Choose "Add a project directory…": the dialog opens. Narrow the window to 375px: the
  dialog has a visible margin on both sides, not edge to edge. Set
  `document.documentElement.style.fontSize = "32px"` in the console and reopen it: the
  dialog scrolls inside itself and the "Add project" button is reachable. Reset with
  `document.documentElement.style.fontSize = ""`.

Stop the dev server.

**Verify**: with the dialog open at 375px, in the console
`(() => { const r = document.querySelector('[role="dialog"]').getBoundingClientRect(); return r.left >= 8 && r.right <= window.innerWidth - 8 && r.bottom <= window.innerHeight; })()` → `true`.

### Step 5: Full gate

**Verify**: `bun run typecheck` → exit 0.
**Verify**: `bun run lint` → exit 0.
**Verify**: `bun test src/components/ui` → all pass.
**Verify**: `bunx prettier --check src/components/ui/dialog.tsx src/components/ui/dialog.test.tsx src/components/ui/select.tsx` → exit 0.
**Verify** (only if it exists): `bun test src/app/design-tokens.test.ts` → all pass.

## Test plan

- New test in `src/components/ui/dialog.test.tsx` (Step 1): the open dialog carries the
  viewport-fitting classes. A class assertion is the honest limit here — happy-dom
  does not lay out — and matches `button.test.tsx`'s precedent.
- The select change is verified by grep and the manual check: Radix Select does not open
  reliably under happy-dom's pointer events, and the existing `select.test.tsx` does not
  try.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun test src/components/ui` exits 0, with the new dialog test passing
- [ ] `grep -c "overflow-y-auto" src/components/ui/dialog.tsx` → `1`
- [ ] `grep -c "max-h-64" src/components/ui/select.tsx` → `0`
- [ ] `git status --short` lists only the three in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `grep -c "radix-select-content-available-height" node_modules/@radix-ui/react-select/dist/index.mjs` → `0` (the installed Radix version does not set the variable; do not fall back to a guess).
- A dialog caller passes a `className` that conflicts with the new width/height classes.
- The Step 4 console check is `false` after your change — report the rect values.
- The token guard test (`src/app/design-tokens.test.ts`, if present) fails on these files.

## Maintenance notes

- `100dvh` (dynamic viewport height) is used rather than `100vh` so the dialog respects a
  mobile browser's collapsing toolbar; every browser Boopervisor targets supports it.
- If a future dialog needs its own size (a wide diff viewer, say), pass `className` with
  a `max-w-*` — `cn()` lets the later class win — rather than editing the primitive.
- Reviewer: check the Restore dialog on `/history` as well as Add project; it has a form
  and footer and is the taller of the two.
