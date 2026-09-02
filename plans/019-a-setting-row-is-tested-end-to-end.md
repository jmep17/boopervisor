# Plan 019: A setting row's save, unset and confirm paths are tested, and a row never shows another file's value

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 547101c..HEAD -- src/components/settings/setting-row.tsx src/components/settings/setting-row.test.tsx src/components/settings/settings-list.tsx src/components/items/item-state-controls.tsx`
> Plan 018 is expected to have changed `setting-row.tsx` (the confirm flow).
> Any other in-scope change: compare the "Current state" excerpts against the
> live code before proceeding; on a mismatch, treat it as a STOP condition.
>
> **Base check**: `git merge-base --is-ancestor 547101c HEAD && echo ok` must
> print `ok`, and plan 018's branch must be merged or rebased in (its row in
> `plans/README.md` says DONE, and `grep -n "confirmedRef" src/components/settings/setting-row.tsx`
> finds a match).

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW/MED (a prop with a default and a React `key`; behaviour is
  otherwise unchanged)
- **Depends on**: plans/018-the-settings-form-writes-what-it-shows.md
- **Category**: tests (plus one correctness fix)
- **Planned at**: commit `547101c`, 2026-09-01

## Why this matters

The four things this product does — write a value, unset a value, carry the
stale-write token to the server, and refuse to write a dangerous key without
confirmation — have no automated test. `setting-row.test.tsx` checks two CSS
classes. The row imports its Server Action directly, so nothing can observe
what it submits. Plans 020–024 all change this row or the controls inside it;
this plan is the net under them.

It also fixes one real bug found on the way: every control seeds its state
from its `value` prop once. Switching a project between `settings.json` and
`settings.local.json`, or switching scope, re-renders the same row instance,
so list, hooks and JSON editors keep showing — and would save — the previous
file's entries.

## Current state

- `src/components/settings/setting-row.tsx` — the row. After plan 018 it
  holds `formRef`, `confirmedRef`, `unsetRef`, an `intent` state and the
  `onSubmit` gate. It still imports the action directly (`:8,43-46`):

```tsx
import { writeSetting, type WriteSettingState } from "@/lib/config/actions";
...
  const [state, submit, pending] = useActionState<WriteSettingState, FormData>(
    writeSetting,
    {}
  );
```

and renders the control at `:138-142`:

```tsx
<ControlComponent
  definition={definition}
  value={perScope[editing]}
  options={options}
/>
```

Only errors are shown (`:129-137`, `error={state.error}`); `state.ok`
(set by `src/lib/config/actions.ts:37`) has no consumer.

- `src/components/settings/setting-row.test.tsx` — two tests, both on
  `truncate`/`break-all` classes for a long uncatalogued value. Keep them.

- `src/components/settings/settings-list.tsx:98-107,124-132` — renders
  `<SettingRow key={definition.key} ...>`; the key is the setting key, which
  is stable across a file switch, so the row instance survives it.

- Controls that seed state once and never re-sync:
  `controls/string-list.tsx:23-24`, `controls/permission-rules.tsx` (seeded
  from `value` after plan 018), `controls/hooks-editor.tsx:55-56`; and every
  control using `defaultValue` (`text.tsx:11`, `json.tsx:22`, `switch.tsx:13`,
  `combobox.tsx:24`) keeps the DOM's value for the same reason.

- The pattern to copy for an injectable action:
  `src/components/items/item-state-controls.tsx:8-10,21-37` takes
  `action: ItemStateAction` as a prop; its tests would mock it. The tested
  exemplar is `src/components/scope-switcher.tsx:81-104` with
  `src/components/scope-switcher.test.tsx:46-80`:

```tsx
    const action = mock<AddProjectFormProps["action"]>(async () => ({
      error: "No such directory.",
    }));
    ...
    const [[, formData]] = action.mock.calls;
    expect(formData.get("path")).toBe("/Users/x/src/api");
```

- `src/components/items/item-state-controls.tsx` — already takes `action`
  as a prop, has no test file.

- `src/components/settings/confirm-write-dialog.tsx:35,61` — the dialog's
  title is `Write {settingKey}?` and its confirm button reads `Write it`.

Copy rules for any new string (from `DESIGN.md`, plan 020): sentence case,
no em dash, `…` not `...`.

## Commands you will need

| Purpose                            | Command                                                 | Expected on success              |
| ---------------------------------- | ------------------------------------------------------- | -------------------------------- |
| Route types (once, fresh worktree) | `bunx next typegen`                                     | `✓ Types generated successfully` |
| Typecheck                          | `bun run typecheck`                                     | exit 0                           |
| Lint                               | `bun run lint`                                          | exit 0                           |
| Tests                              | `bun test`                                              | `0 fail`                         |
| Row tests                          | `bun test src/components/settings/setting-row.test.tsx` | all pass                         |
| Format                             | `bunx prettier --check <touched files>`                 | exit 0                           |

## Scope

**In scope**:

- `src/components/settings/setting-row.tsx`
- `src/components/settings/setting-row.test.tsx`
- `src/components/items/item-state-controls.test.tsx` (create)
- `plans/README.md` (status row)

**Out of scope**:

- `src/components/settings/settings-list.tsx` — the row's `key` there stays
  the setting key; the remount is done inside the row (step 3).
- `src/lib/config/actions.ts` — the action is unchanged; it is injected, not edited.
- Every control under `src/components/settings/controls/` — plan 022 changes
  them; the remount key makes their seeding correct without touching them.
- `src/components/settings/confirm-write-dialog.tsx`.

## Git workflow

- Branch: `advisor/019-a-setting-row-is-tested-end-to-end`, from `main` after 018.
- Commit per step; one imperative sentence per message, no prefix.
- Pre-commit runs prettier, typecheck and the suite; commit only when green.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Inject the action

In `setting-row.tsx`:

```tsx
export type WriteSettingAction = (
  previous: WriteSettingState,
  formData: FormData
) => Promise<WriteSettingState>;

export interface SettingRowProps {
  ...
  /** The Server Action that writes; given so a test can observe what is submitted. */
  action?: WriteSettingAction;
}
```

Destructure `action = writeSetting` and pass `action` to `useActionState`.
Nothing else changes; `settings-list.tsx` keeps not passing it.

**Verify**: `bun run typecheck` → exit 0; `bun test src/components/settings` → all pass.

### Step 2: Report a successful save

- Add `const [touched, setTouched] = useState(false);`.
- On the `<form>`: `onChange={() => setTouched(true)}`; in the existing
  `onSubmit` handler, call `setTouched(false)` first (before the dangerous
  gate), so a submission clears the touched flag whether or not it is
  confirmed.
- After the buttons `<div>`, render:

```tsx
{
  state.ok && !touched ? (
    <p role="status" className="text-sm text-gray-900">
      Saved.
    </p>
  ) : null;
}
```

**Verify**: `bun run typecheck` → exit 0.

### Step 3: Remount the control when the value it was seeded from changes

Change the control render to:

```tsx
<ControlComponent
  key={`${editing}:${show(perScope[editing])}`}
  definition={definition}
  value={perScope[editing]}
  options={options}
/>
```

`show` is the file's existing helper (`value === undefined ? "Not set" : JSON.stringify(value)`).
The key changes exactly when the file being edited, or the value in it,
changes: after a file or scope switch, and after this row's own save
(revalidation re-reads the file). It does not change when another row saves,
so in-progress edits elsewhere on the page survive.

**Verify**: `bun run typecheck` → exit 0.

### Step 4: Row tests

Rewrite `setting-row.test.tsx`, keeping the two existing class tests. Use
real catalog definitions: `getSetting("plansDirectory")!` (a plain `text`
control, not dangerous) and `getSetting("apiKeyHelper")!` (a `text` control,
`dangerous: true`). Helper:

```tsx
function renderRow(props: Partial<SettingRowProps> & { action: WriteSettingAction }) { ... }
```

defaulting to `editing="user"`, `expected="tok"`, `readOnly={false}`, an
unset `effective` (`perScope: {}`, `winningScope: "user"`), and
`options={{}}`. Cases:

1. `saves through the action with key, scope, expected and value` — type
   `/tmp/plans` into the textbox, click `Save`, `await waitFor(() => expect(action).toHaveBeenCalled())`;
   `formData.get("key") === "plansDirectory"`, `scope === "user"`,
   `expected === "tok"`, `value === "/tmp/plans"`, `formData.get("unset") === null`;
   then `await screen.findByRole("status")` has text `Saved.`.
2. `unsets through the Unset button` — `perScope: { user: "/old" }`; click
   `Unset`; `formData.get("unset") === "1"`.
3. `shows what the server said` — action resolves `{ error: "That file changed on disk." }`;
   `await screen.findByRole("alert")` has that text.
4. `asks before writing a dangerous key and writes only after Write it` —
   `apiKeyHelper`; type `/bin/helper`; click `Save`; the dialog
   `screen.getByRole("dialog", { name: "Write apiKeyHelper?" })` is present
   and `action` has not been called; click `Write it`; action called with
   `value === "/bin/helper"` and `unset === null`.
5. `Enter in a dangerous row opens the dialog instead of writing` — type
   `/bin/helper{Enter}` into the textbox; dialog present; action not called.
   If `userEvent` does not trigger implicit submission under happy-dom, use
   `fireEvent.submit(screen.getByRole("form"))` — give the form
   `aria-label={`Edit ${key}`}` so it has a role name — and assert the same.
6. `unsetting a dangerous key also asks, then removes the key` —
   `apiKeyHelper` with `perScope: { user: "/bin/old" }`; click `Unset`;
   dialog present, action not called; click `Write it`; `unset === "1"`.
7. `hides Saved once the value is edited again` — after case 1's flow,
   type another character: `screen.queryByRole("status")` is null.
8. `shows the new value when the file's value changes` — render with
   `perScope: { user: "/one" }`, type `x` into the textbox, then `rerender`
   with `perScope: { user: "/two" }`: the textbox value is `/two`.
9. `managed rows have no form` — `readOnly` true: no textbox, the text
   `Boopervisor only reads them` is present.

**Verify**: `bun test src/components/settings/setting-row.test.tsx` → 11 pass, 0 fail.

### Step 5: ItemStateControls tests

Create `src/components/items/item-state-controls.test.tsx` (pattern:
`scope-switcher.test.tsx`):

1. `submits the target state with the identifying fields` — `state="enabled"`,
   `fields={{ item: "skill", name: "tdd", expected: "tok" }}`; click
   `Archive`; the action's `FormData` has `state === "archived"` and every
   field.
2. `disables the current state's button` — `state="enabled"`: the `Enable`
   button is disabled, `Disable` and `Archive` are not.
3. `locks every button when a higher scope decides` — `lockedReason="Set by managed settings."`:
   all three disabled and the reason is shown.
4. `shows the server's error` — action resolves `{ error: "Stale write refused." }`;
   `findByRole("alert")` has it.

**Verify**: `bun test src/components/items/item-state-controls.test.tsx` → 4 pass.

### Step 6: Gates and index

**Verify**: `bun run typecheck` 0 · `bun run lint` 0 · `bun test` 0 fail ·
prettier check on touched files 0. Update the index row.

## Test plan

Steps 4 and 5 are the test plan. Model on `scope-switcher.test.tsx` for the
mocked action and on `src/components/ui/dialog.test.tsx` for querying an open
dialog by role and name.

## Done criteria

- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun test` exits 0; `setting-row.test.tsx` has 11 passing tests and
      `item-state-controls.test.tsx` exists with 4
- [ ] `grep -n "action = writeSetting" src/components/settings/setting-row.tsx` matches
- [ ] `grep -n 'role="status"' src/components/settings/setting-row.tsx` matches
- [ ] `grep -n 'key={`${editing}:${show(perScope\[editing\])}`}' src/components/settings/setting-row.tsx` matches (or the equivalent on one line)
- [ ] `git status --short` shows nothing outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

- `setting-row.tsx` does not contain `confirmedRef` — plan 018 has not
  landed; stop, this plan builds on its flow.
- Case 4 or 6 fails because `requestSubmit()` is missing or ignores the
  disabled hidden field under happy-dom. Report the exact failure; do not
  replace `requestSubmit()` with a manual `action()` call — that would test
  a path the browser never runs.
- Any test needs to open the Radix `Select` popover. It must not; choose a
  `text`-control definition as specified.
- A step's verification fails twice.

## Maintenance notes

- Plans 021 and 022 add rows and controls; their row-level tests should use
  `renderRow` from this file rather than a second helper.
- The remount key relies on `show()` producing a stable string for the same
  value; if a control ever needs to survive a value change (live external
  edits are not watched — `docs/PLAN.md`), revisit the key.
- Reviewer focus: the `FormData` assertions in cases 1, 2, 4, 6 — those are
  the contract with `readWriteSettingForm` (`src/lib/config/write-setting.ts:24-61`).
