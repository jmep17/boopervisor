# Plan 018: The settings form writes what its controls show

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 547101c..HEAD -- src/components/settings/controls/permission-rules.tsx src/components/settings/controls/permission-rules.test.tsx src/components/settings/controls/literal-toggle.tsx src/components/settings/controls/literal-toggle.test.tsx src/components/settings/controls/switch.tsx src/components/settings/controls/switch.test.tsx src/components/settings/controls/select.test.tsx src/components/settings/controls/hooks-editor.tsx src/components/settings/control-component.tsx src/components/settings/setting-row.tsx src/lib/config/value-form.ts src/lib/config/value-form.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **Base check (run second)**: `git merge-base --is-ancestor 547101c HEAD && echo ok`
> must print `ok`. A previous executor built on a five-commit-stale base and
> its "all gates pass" was meaningless. If it does not print `ok`, rebase your
> branch onto `main` before doing anything else.

## Status

- **Priority**: P0
- **Effort**: M
- **Risk**: MED (changes what three security-relevant keys and four literal
  keys write; every change has a round-trip test)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `547101c`, 2026-09-01

## Why this matters

Boopervisor exists to write Claude Code's settings files correctly. Four of
its controls do not. The permission-rules editor cannot load or save
`permissions.allow`, `permissions.ask` or `permissions.deny` at all: it is
handed an array, refuses it, shows three empty lists, and on Save submits an
object the server rejects. The literal-toggle control writes the string `"on"`
for keys whose only legal value is `"disable"` or `"disabled"`, so a user who
turns off auto mode has not turned it off. Saving an untouched boolean row
writes an explicit `false`. And on a row that asks for confirmation, pressing
Enter in a text field activates the Unset button and deletes the key with no
dialog at all.

All four were confirmed by running the real modules (see "Current state").
Each fix is small; the value is that the app stops silently doing the wrong
thing on its most important surface.

## Current state

Files and their roles:

- `src/components/settings/controls/permission-rules.tsx` — the editor for
  the three permission keys. Broken end to end.
- `src/components/settings/controls/permission-rules.test.tsx` — its tests,
  which feed it an _object_ and so never see the bug.
- `src/components/settings/controls/literal-toggle.tsx` — the checkbox for
  present-as-one-string keys. Ignores its `literal` prop when submitting.
- `src/components/settings/controls/switch.tsx` — the On/Off dropdown for
  Boolean keys.
- `src/lib/config/value-form.ts` — turns a submitted form field into a value.
- `src/components/settings/setting-row.tsx` — the row: form, Save, Unset,
  and the confirmation dialog for dangerous keys.
- `src/components/settings/control-component.tsx` — maps a catalog definition
  to a control and builds its props.
- `src/components/settings/controls/hooks-editor.tsx` — only line 137 is in
  scope (a dead hidden field).
- `src/components/settings/controls/switch.test.tsx`,
  `src/components/settings/controls/select.test.tsx` — contain assertions
  that cannot fail; fixed here because the switch behaviour changes.

### Bug A: the permission editor is handed an array and refuses it

The catalog gives the three keys the editor (`src/lib/catalog/overrides.ts:105-110`):

```ts
  "permissions.allow": {
    note: "Permission rules have their own syntax and a typo silently changes what Claude Code will do unprompted.",
    control: "permissionRules",
  },
  "permissions.ask": { note: "See `permissions.allow`.", control: "permissionRules" },
  "permissions.deny": { note: "See `permissions.allow`.", control: "permissionRules" },
```

The row passes the control the value _at that key_ — for `permissions.allow`
that is the array of rule strings (`src/components/settings/setting-row.tsx:138-142`):

```tsx
<ControlComponent
  definition={definition}
  value={perScope[editing]}
  options={options}
/>
```

The control expects an object (`src/components/settings/controls/permission-rules.tsx:113-122`):

```tsx
export function PermissionRulesControl({ value }: PermissionRulesControlProps) {
  // Parse the value into allow, ask, deny arrays
  const parsed = parsePermissionsObject(value);
  const initialAllow = parsed.ok ? parsed.allow : [];
  const initialAsk = parsed.ok ? parsed.ask : [];
  const initialDeny = parsed.ok ? parsed.deny : [];
```

and `parsePermissionsObject` rejects an array (`src/lib/config/permissions.ts:73-76`):

```ts
export function parsePermissionsObject(value: unknown): ParsePermissionsResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, problem: "Permissions must be an object." };
  }
```

So every rule on disk is invisible in the editor. On Save the control submits
an object (`permission-rules.tsx:188-193,234`):

```tsx
  const submittedValue: Record<string, unknown> = {};
  if (allow.length > 0) submittedValue.allow = allow;
  if (ask.length > 0) submittedValue.ask = ask;
  if (deny.length > 0) submittedValue.deny = deny;
  const serialized = JSON.stringify(submittedValue);
  ...
      <input type="hidden" name="value" value={serialized} />
```

and the server requires an array (`src/lib/config/validate.ts:28-38`):

```ts
  if (
    setting.key === "permissions.allow" ||
    setting.key === "permissions.ask" ||
    setting.key === "permissions.deny"
  ) {
    // These are arrays of permission rules
    if (!Array.isArray(value)) {
      return {
        ok: false,
        problem: `Expected array of rules, got ${typeof value}`,
      };
    }
```

Reproduced with the real modules:

```
parsePermissionsObject(["Bash(npm *)"])          -> {"ok":false,"problem":"Permissions must be an object."}
validateSetting({allow:["Bash"]}, permissions.allow) -> {"ok":false,"problem":"Expected array of rules, got object"}
validateSetting(["Bash"], permissions.allow)      -> {"ok":true}
```

The only thing that works on those three rows today is Unset.

The control also carries dead scaffolding (`permission-rules.tsx:124` and
`:236-237`): `const [errors] = useState<Record<string, string>>({});` has no
setter, so the per-rule error at lines 91-95 can never render, and the hidden
`validateOnSubmit` field has no reader anywhere in `src/` (the same field is
emitted at `hooks-editor.tsx:137`).

### Bug B: the literal toggle submits `"on"`

`src/components/settings/controls/literal-toggle.tsx:11-26`:

```tsx
export function LiteralToggleControl({
  value,
  literal = "on",
}: LiteralToggleControlProps) {
  const isSet = value === literal;
  const [checked, setChecked] = useState(isSet);
  const inputId = useId();

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={inputId}
        defaultChecked={isSet}
        onCheckedChange={(c) => setChecked(Boolean(c))}
      />
      <input type="hidden" name="value" value={checked ? "on" : ""} />
```

The four keys using it expect `"disable"` (`disableAutoMode`,
`disableDeepLinkRegistration`, `permissions.disableBypassPermissionsMode`) or
`"disabled"` (`browserExternalPageTools`) — see `src/lib/catalog/overrides.ts:62-85`.
The server passes a string through unchanged
(`parseValueForSetting("on", disableAutoMode)` → `{"ok":true,"value":"on"}`),
so the file ends up holding `"disableAutoMode": "on"`, which Claude Code does
not recognise.

### Bug C: an untouched Boolean row saves `false`

`src/components/settings/controls/switch.tsx:9-18`:

```tsx
export function SwitchControl({ value }: SwitchControlProps) {
  return (
    <Select
      name="value"
      defaultValue={value === undefined ? "" : String(Boolean(value))}
    >
      <SelectItem value="true">On</SelectItem>
      <SelectItem value="false">Off</SelectItem>
    </Select>
  );
}
```

An unset key submits `value=""`, and `src/lib/config/value-form.ts:42-44`
turns that into `false`:

```ts
  switch (definition?.valueType) {
    case "boolean":
      return { ok: true, value: text === "true" || text === "on" };
```

Reproduced: `parseValueForSetting("", verbose)` → `{"ok":true,"value":false}`.
The string branch already does the right thing (`:52-55`: empty text → `undefined`).

### Bug D: Enter in a text field unsets a dangerous key without confirmation

On a dangerous row, Save is `type="button"` (it opens the dialog), so the
first — and only — submit button in the form is Unset
(`src/components/settings/setting-row.tsx:145-170`):

```tsx
<div className="flex items-center gap-2">
  {dangerous ? (
    <Button
      type="button"
      onClick={() => setConfirming(true)}
      disabled={pending}
    >
      {pending ? "Saving" : "Save"}
    </Button>
  ) : (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving" : "Save"}
    </Button>
  )}
  {editing in perScope ? (
    <Button
      type="submit"
      name="unset"
      value="1"
      variant="secondary"
      disabled={pending}
    >
      Unset
    </Button>
  ) : null}
</div>
```

HTML implicit submission (Enter in a single-line text input) activates the
form's first submit button. On `apiKeyHelper` and `awsAuthRefresh` (dangerous,
`text` control) that is Unset: the keystroke deletes the key, and the dialog
never opens. The dialog is wired at `:174-186`:

```tsx
{
  definition?.dangerous ? (
    <ConfirmWriteDialog
      open={confirming}
      onOpenChange={setConfirming}
      settingKey={key}
      reason={definition.overrideNote}
      pending={pending}
      onConfirm={() => {
        setConfirming(false);
        formRef.current?.requestSubmit();
      }}
    />
  ) : null;
}
```

### Conventions to match

- Every control submits one field named `value`; structured values go as JSON
  in a hidden input. Exemplar: `src/components/settings/controls/string-list.tsx:54,109`.
- Tests use `bun:test` + Testing Library + `userEvent`; a hidden field is read
  back with a `hiddenValue()` helper. Exemplar:
  `src/components/settings/controls/string-list.test.tsx:6-13,101-117`.
- Error text in the interface is `text-sm text-red-900`
  (`src/components/ui/field.tsx:113`). Do not use `text-xs`.
- Copy: sentence case, no em dashes, no `...` (use the `…` character). These
  rules come from `DESIGN.md` (plan 020); honour them in any new string.
- Colour and radius classes must be Geist tokens; `bun test src/app/design-tokens.test.ts`
  fails otherwise.

## Commands you will need

| Purpose                            | Command                                                               | Expected on success                                    |
| ---------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------ |
| Install                            | `bun install`                                                         | exit 0                                                 |
| Route types (once, fresh worktree) | `bunx next typegen`                                                   | `✓ Types generated successfully`                       |
| Typecheck                          | `bun run typecheck`                                                   | exit 0, no output after `$ tsc --noEmit`               |
| Lint                               | `bun run lint`                                                        | exit 0                                                 |
| Tests                              | `bun test`                                                            | `398 pass` at baseline; more after this plan, `0 fail` |
| One test file                      | `bun test src/components/settings/controls/permission-rules.test.tsx` | all pass                                               |
| Format check                       | `bunx prettier --check <files you touched>`                           | exit 0                                                 |

`bun run typecheck` fails on `PageProps`/`LayoutProps` in a worktree where
`bunx next typegen` (or `next dev`) has never run. Run typegen first; its
output (`.next/`, `next-env.d.ts`) is gitignored.

## Scope

**In scope** (the only files you should modify):

- `src/components/settings/controls/permission-rules.tsx`
- `src/components/settings/controls/permission-rules.test.tsx`
- `src/components/settings/controls/literal-toggle.tsx`
- `src/components/settings/controls/literal-toggle.test.tsx`
- `src/components/settings/controls/switch.tsx`
- `src/components/settings/controls/switch.test.tsx`
- `src/components/settings/controls/select.test.tsx`
- `src/components/settings/controls/hooks-editor.tsx` (delete one line only)
- `src/components/settings/control-component.tsx`
- `src/components/settings/setting-row.tsx`
- `src/lib/config/value-form.ts`
- `src/lib/config/value-form.test.ts`
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):

- `src/lib/config/permissions.ts` — `parsePermissionsObject` and
  `validatePermissionsObject` are correct for the object shape the server
  validates against; leave them.
- `src/lib/config/validate.ts`, `src/lib/config/write-setting.ts`,
  `src/lib/config/actions.ts` — the server side is right; the client was wrong.
- `src/components/settings/confirm-write-dialog.tsx` — unchanged.
- `src/components/settings/setting-row.test.tsx` — plan 019 rewrites it; do
  not add row-level tests here.
- Any control not named above.

## Git workflow

- Branch: `advisor/018-the-settings-form-writes-what-it-shows`, from `main`.
- Commit per step. Message style: one imperative sentence, no prefix, e.g.
  `Make the permission-rules control edit the one list its key names`.
- `.husky/pre-commit` runs prettier (via lint-staged), typecheck and the full
  test suite. Commit only when all pass; do not use `--no-verify`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make the permission-rules control per-key

Rewrite `src/components/settings/controls/permission-rules.tsx` so it edits
**one** list — the one its key names — and submits a JSON array.

Props:

```tsx
export interface PermissionRulesControlProps {
  /** The array at `permissions.<list>` on disk, or undefined when unset. */
  value: unknown;
  list: "allow" | "ask" | "deny";
}
```

Behaviour:

- Seed `useState<string[]>` from `Array.isArray(value) ? value.map(String) : []`.
- Render one heading-less list (the row already names the key). Above the
  list, one sentence of plain text (`text-sm text-gray-900`) stating the
  evaluation order, from this table — the order matters and the interface
  must say so (`docs/settings-catalog.md`, "Permission rule syntax"):
  - `deny`: `Deny rules are checked first. The first matching rule decides.`
  - `ask`: `Ask rules are checked after deny rules and before allow rules.`
  - `allow`: `Allow rules are checked last. A deny or ask rule that matches wins over these.`
- Keep the per-rule Input with move up / move down / remove, and the Add
  button labelled `Add rule`. Give each Input `id={`${baseId}-${index}`}`
  from a `useId()` and `aria-label={`Rule ${index + 1}`}` so no two inputs
  share an id (today every Input inside a `Field` inherits the same id).
- Inline validation, computed during render (no state): for each non-blank
  rule, `validatePermissionRule(rule)` from `@/lib/config/permissions`; when
  it fails, set `aria-invalid` on that Input and render the problem beneath
  it as `<p id={`${inputId}-problem`} className="text-sm text-red-900">`,
  linked with `aria-describedby`. Blank rules show nothing.
- Hidden field: `<input type="hidden" name="value" value={JSON.stringify(rules.filter((r) => r.trim() !== ""))} />`.
  Blank entries are dropped so an added-then-abandoned row does not fail the
  save. When the filtered array is empty, submit `[]` — the server writes an
  empty array; Unset is the way to remove the key.
- Delete the `errors` state, the `validateOnSubmit` hidden input, and the
  three-list `RuleList` plumbing.

Then in `src/components/settings/control-component.tsx`, after the existing
`literalToggle` block, add:

```tsx
if (definition.control === "permissionRules") {
  const list = definition.key.split(".")[1];
  if (list === "allow" || list === "ask" || list === "deny") {
    controlProps.list = list;
  }
}
```

**Verify**: `bun run typecheck` → exit 0 (the tests will not compile yet; that is step 2).

### Step 2: Rewrite the permission-rules tests for the per-key shape

Replace `src/components/settings/controls/permission-rules.test.tsx`. Keep the
`hiddenValue()` helper. Cases:

1. `renders the rules on disk` — `value={["Bash", "Read(./.env)"]}`, `list="allow"`:
   two textboxes with those values.
2. `renders empty for an unset key` — `value={undefined}`: zero textboxes,
   hidden field is `[]`.
3. `says where its list sits in the evaluation order` — for `list="deny"`
   the text `Deny rules are checked first` is present.
4. `submits a JSON array, dropping blank rules` — start with `["Bash"]`, click
   `Add rule`, do not type: `JSON.parse(hiddenValue())` equals `["Bash"]`.
5. `flags a rule the syntax refuses` — type `Bash(` into a rule: that
   textbox has `aria-invalid="true"` and the text `unmatched parentheses` is
   shown; the hidden field still carries the text (the server is the final
   judge).
6. `reorders and removes` — carry over the existing move-down and remove
   cases, adapted to `list="allow"` and an array value.

**Verify**: `bun test src/components/settings/controls/permission-rules.test.tsx` → 6 pass, 0 fail.

### Step 3: Remove the dead hidden field from the hooks editor

Delete line 137 of `src/components/settings/controls/hooks-editor.tsx`:

```tsx
<input type="hidden" name="validateOnSubmit" value="hooks" />
```

**Verify**: `grep -rn "validateOnSubmit" src/` → no matches.
`bun test src/components/settings/controls/hooks-editor.test.tsx` → all pass.

### Step 4: Make the literal toggle submit its literal

In `src/components/settings/controls/literal-toggle.tsx`:

- Make `literal` required: `literal: string;` (remove the `= "on"` default).
- Hidden field: `value={checked ? literal : ""}`.

`control-component.tsx` already passes `definition.literal`; because the
registry's props are untyped, also guard there: in the `literalToggle` block,
`controlProps.literal = definition.literal ?? "";` (the catalog test
`a literal toggle knows what string it writes` guarantees it is never
actually empty).

Add to `literal-toggle.test.tsx`:

- `submits the literal when checked` — `value="disable" literal="disable"`:
  the hidden `input[name="value"]` has value `disable`.
- `submits nothing when unchecked` — `value={undefined} literal="disable"`:
  hidden value is `""`; after `userEvent.click` on the checkbox it is `disable`.

**Verify**: `bun test src/components/settings/controls/literal-toggle.test.tsx` → 7 pass.
`grep -n '"on"' src/components/settings/controls/literal-toggle.tsx` → no matches.

### Step 5: An untouched Boolean stays unset

In `src/lib/config/value-form.ts`, change the boolean branch to:

```ts
    case "boolean":
      if (text === "") return { ok: true, value: undefined };
      return { ok: true, value: text === "true" || text === "on" };
```

In `src/components/settings/controls/switch.tsx`, add `placeholder="Not set"`
to the `Select` so an unset row reads "Not set" rather than blank.

Add to `value-form.test.ts`:

```ts
test("an empty Boolean submission leaves the key unset rather than writing false", () => {
  expect(parseValueForSetting("", booleanKey)).toEqual({
    ok: true,
    value: undefined,
  });
});
```

Rewrite `switch.test.tsx` so every test asserts something that can fail:

- `shows On for true` / `shows Off for false` — render inside
  `<Field label="Verbose">` and assert `screen.getByLabelText("Verbose")`
  has text content `On` / `Off` (pattern: `src/components/ui/select.test.tsx:21-33`).
- `shows Not set for an unset key` — text content `Not set`.
- `submits under the name value` — `container.querySelector('[name="value"]')`
  is not null (`expect(...).not.toBeNull()`; the current `toBeDefined()` passes for `null`).

In `select.test.tsx`, fix the same `toBeDefined()` at lines 18-19 to
`not.toBeNull()`, and make `handles empty enum values list` assert the trigger
renders with no items rather than only that a combobox exists.

**Verify**: `bun test src/lib/config/value-form.test.ts src/components/settings/controls/switch.test.tsx src/components/settings/controls/select.test.tsx` → all pass;
`grep -n "toBeDefined" src/components/settings/controls/switch.test.tsx src/components/settings/controls/select.test.tsx` → no matches.

### Step 6: Enter can never bypass the confirmation

In `src/components/settings/setting-row.tsx`, restructure the dangerous-row
submission so **every** submission of a dangerous row goes through the dialog,
whatever triggered it:

- Add `const confirmedRef = useRef(false);` and
  `const unsetRef = useRef<HTMLInputElement>(null);`.
- Render, inside the form and before the buttons, a hidden field that is
  normally excluded from submission:
  `<input ref={unsetRef} type="hidden" name="unset" value="1" disabled />`
  (a disabled input is not included in `FormData`).
- On dangerous rows render **both** buttons as `type="button"`: Save calls
  `openConfirm("save")`, Unset calls `openConfirm("unset")`, where
  `openConfirm` stores the intent in state (`useState<"save" | "unset">`) and
  sets `confirming` to true. On non-dangerous rows keep today's submit buttons
  exactly as they are.
- Give the form `onSubmit={(event) => { if (dangerous && !confirmedRef.current) { event.preventDefault(); openConfirm("save"); } }}`.
  This is what catches implicit submission (Enter): a form with no submit
  buttons still submits on Enter when it holds one text field, and this
  handler turns that into the dialog instead.
- `ConfirmWriteDialog.onConfirm`:

```tsx
onConfirm={() => {
  setConfirming(false);
  if (unsetRef.current) unsetRef.current.disabled = intent !== "unset";
  confirmedRef.current = true;
  try {
    formRef.current?.requestSubmit();
  } finally {
    confirmedRef.current = false;
    if (unsetRef.current) unsetRef.current.disabled = true;
  }
}}
```

`requestSubmit()` dispatches the submit event synchronously, so the flag and
the hidden field are back to their resting state before anything else runs,
and the action's `FormData` carries `unset=1` only for an unset intent.

Keep the non-dangerous path byte-for-byte as it is (Save is the first submit
button, so Enter saves).

**Verify**: `bun run typecheck` → exit 0. `bun test src/components/settings` → all pass.
Manual check (start `bun dev`, open http://127.0.0.1:3000/settings, expand
`apiKeyHelper`, type anything, press Enter): the "Write apiKeyHelper?" dialog
opens and nothing is written until "Write it"; Cancel writes nothing.
Then click Unset on a dangerous key that is set: the dialog opens, "Write it"
removes the key. Confirm the History page shows the writes you made and
restore them if they were not on a scratch settings file.

### Step 7: Full gates and index

**Verify**: `bun run typecheck` → exit 0 · `bun run lint` → exit 0 ·
`bun test` → `0 fail`, at least 404 pass · `bunx prettier --check` on every
file you touched → exit 0. Update this plan's row in `plans/README.md`.

## Test plan

- New tests listed in steps 2, 4, 5; model them on
  `src/components/settings/controls/string-list.test.tsx` (hidden-field
  round trip) and `src/components/ui/select.test.tsx` (label + text content).
- The Enter/dialog behaviour of step 6 is verified manually here; plan 019
  makes the row's action injectable and adds the automated test for it. Do
  not attempt to unit-test `requestSubmit()` in this plan.
- Verification: `bun test` → all pass, including the new cases; the
  regression each fixes is named in its test title.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun test` exits 0 with at least 404 passing tests
- [ ] `grep -rn "validateOnSubmit" src/` returns no matches
- [ ] `grep -n "parsePermissionsObject" src/components/settings/controls/permission-rules.tsx` returns no matches
- [ ] `grep -n '"on"' src/components/settings/controls/literal-toggle.tsx` returns no matches
- [ ] `grep -n "toBeDefined" src/components/settings/controls/switch.test.tsx src/components/settings/controls/select.test.tsx` returns no matches
- [ ] `bun -e 'const vf = await import("./src/lib/config/value-form.ts"); const c = await import("./src/lib/catalog/index.ts"); console.log(JSON.stringify(vf.parseValueForSetting("", c.getSetting("verbose"))))'` prints `{"ok":true}` (value undefined is omitted by JSON)
- [ ] `git status --short` shows no file outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" does not match the excerpts.
- `parsePermissionsObject` at `src/lib/config/permissions.ts:73` accepts an
  array — that means someone already fixed the shape another way; reconcile
  before continuing.
- A step's verification fails twice after a reasonable fix attempt.
- Step 6's manual check shows Enter still submitting without the dialog, or
  "Write it" after an Unset intent saving the value instead of removing the
  key. Both mean `requestSubmit()`/disabled-input behaviour differs from what
  this plan assumes; report rather than patch around it.
- The fix appears to require touching `src/lib/config/validate.ts` or
  `permissions.ts`.

## Maintenance notes

- Plan 019 rewrites `setting-row.test.tsx` around an injectable action and
  will exercise the step 6 flow automatically; keep the `confirmedRef`,
  `unsetRef` and intent names, it refers to them.
- Plan 022 replaces `SwitchControl`'s underlying `Select` with a searchable
  picker; the `placeholder="Not set"` and the empty-means-unset contract from
  step 5 must survive that change.
- Plan 024 restyles the permission-rules and hooks editors (icon buttons,
  labels). It assumes the per-key control from step 1.
- Reviewer focus: the `FormData` a dangerous row submits after "Write it"
  (with and without an unset intent), and that `permissions.allow` on a real
  file round-trips through the editor unchanged.
- Deferred: an "are you sure" for Unset on non-dangerous keys (not asked for);
  server-side enforcement of `dangerous` (considered and rejected in the
  index: the dialog is a slip guard, not a security control).
