# Plan 001: The hooks editor reads and writes Claude Code's documented hooks shape, and never wipes hooks it cannot parse

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 69744da..HEAD -- src/lib/config/hooks.ts src/lib/config/hooks.test.ts src/lib/config/validate.ts src/lib/config/validate.test.ts src/components/settings/controls/hooks-editor.tsx src/components/settings/controls/hooks-editor.test.tsx docs/verified-file-formats.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P0
- **Effort**: M
- **Risk**: LOW — the change is confined to the hooks parser, validator and editor; every other setting's write path is untouched.
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `69744da`, 2026-08-30

## Why this matters

Boopervisor's whole reason to exist is that it writes Claude Code's files _safely_. The
hooks editor currently does the opposite. Claude Code's `hooks` key is a three-level
structure — event → array of `{ matcher, hooks }` groups → array of hook actions each with a
`type` — and Boopervisor's parser expects a two-level `{ matcher, command }` list instead.
Two things follow:

1. A real hooks value (for example the one on the author's machine:
   `{"SessionStart":[{"hooks":[{"type":"command","command":"…","timeout":30}]}]}`) fails to
   parse, so the editor initialises **empty**, and pressing Save writes `"hooks": {}`. The
   user's hooks are deleted without any warning.
2. A hook added through the editor is written as `[{"matcher":"","command":"…"}]`, which
   Claude Code does not read, so the hook silently never runs.

The catalog already documents the correct shape. `src/lib/catalog/settings.data.json`, entry
`hooks`, `typeText`:

> object keyed by hook event; each value is an array of `{ "matcher", "hooks" }` groups whose
> `hooks` entries have a `type` of `"command"`, `"prompt"`, `"agent"`, `"http"`, or `"mcp_tool"`

The official reference (https://code.claude.com/docs/en/hooks.md, checked 2026-08-30) says
the same: "Hooks are defined in JSON with three nesting levels". A `command` hook has
`command` (string) and optional `timeout` (number, seconds) and `async` (Boolean). Other
types carry their own fields (`prompt`/`model` for `prompt`; `url`, `headers`,
`allowedEnvVars`, `timeout` for `http`; `server`, `tool`, `input` for `mcp_tool`). `matcher`
is optional and only meaningful on tool-related events; leaving it out or writing `"*"` means
every occurrence.

After this plan: the parser accepts the documented shape and refuses the flat one; the editor
edits `command` hooks as a form, shows every other hook type read-only, and round-trips
anything it does not edit byte-for-byte in substance; and a hooks value the parser cannot
read is **never** replaced with an empty one — the editor falls back to the JSON control
showing the value as it is on disk.

## Current state

Files:

- `src/lib/config/hooks.ts` — parse / validate / assemble for the `hooks` key. This is the
  wrong model.
- `src/lib/config/hooks.test.ts` — tests of the wrong model (all use flat `{ matcher, command }`).
- `src/lib/config/validate.ts` — `validateSetting` dispatches `hooks` to `validateHooksObject` (line 45-47). Keep that dispatch; the function behind it changes.
- `src/lib/config/value-form.ts` — `parseValueForSetting` parses the hooks form field as JSON (lines 35-40). No change needed.
- `src/components/settings/controls/hooks-editor.tsx` — the client editor.
- `src/components/settings/controls/hooks-editor.test.tsx` — its tests (flat shape).
- `src/lib/catalog/hooks.ts` — `HOOK_EVENTS` (31 documented events, from `hooks.data.json`) and `isUnknownHookEvent`. Read-only for this plan.
- `docs/verified-file-formats.md` — the record of which file-format assumptions were checked. Gets a new section.

`src/lib/config/hooks.ts:861-877` — the current model:

```ts
export interface HookEntry {
  event: string;
  matcher: string;
  command: string;
}

export interface ParsedHooks {
  ok: true;
  hooks: Record<string, Array<{ matcher: string; command: string }>>;
}
```

`src/lib/config/hooks.ts:927-935` — where a real file fails:

```ts
const entryObj = entry as Record<string, unknown>;
if (typeof entryObj.command !== "string") {
  return {
    ok: false,
    problem: `Hook entry in ${event} must have a command.`,
  };
}
```

`src/components/settings/controls/hooks-editor.tsx:904-919` — where the wipe originates
(`parsed.ok` is false, so `initialHooks` is `{}`):

```tsx
export function HooksEditorControl({ value }: HooksEditorControlProps) {
  // Parse the value into event → entries map
  const parsed = parseHooksObject(value);
  const initialHooks = parsed.ok ? parsed.hooks : {};
```

`src/components/settings/controls/hooks-editor.tsx:951-961` — the flat serialisation:

```tsx
const submittedValue: Record<string, unknown> = {};
for (const [event, entries] of Object.entries(hooks)) {
  if (entries.length > 0) {
    submittedValue[event] = entries.map((entry) => ({
      matcher: entry.matcher,
      command: entry.command,
    }));
  }
}
const serialized = JSON.stringify(submittedValue);
```

How a hooks write reaches disk (unchanged by this plan): the hidden `value` field →
`writeSetting` in `src/lib/config/actions.ts` → `parseValueForSetting` (JSON) →
`mutateSetting` → `validateSetting` → `validateHooksObject` → `mutateJsonFile`. Every write is
backed up first and refused if the file changed since it was read; that machinery is why the
wipe was recoverable, not why it is acceptable.

Conventions to match:

- Vocabulary from `CONTEXT.md`: a **setting** is one named key; a **mutation** is one
  user-initiated write. Do not introduce "config", "update" or "entity" in names or comments.
- Result shapes are discriminated unions, never thrown errors, for expected failures:
  `{ ok: true, … } | { ok: false, problem: string }` — see `ValidationResult` in
  `src/lib/config/validate.ts:6-15` and `ParseHooksResult` in the same file you are editing.
- Comments explain _why_, sparingly, in the voice of the existing code (see the top of
  `src/lib/config/mutate.ts`). Match its density; no narrating what the code plainly does.
- Client controls live in `src/components/settings/controls/`, use `Button`, `Input` from
  `src/components/ui/`, and only Geist token utilities (`text-gray-900`, `border-gray-alpha-300`,
  `rounded-base`, `text-red-900`). A hardcoded hex or a Tailwind palette colour like
  `bg-zinc-50` will not compile — the palette is cleared in `src/app/globals.css`.
- Component tests use `@testing-library/react` with `bun:test`; the existing
  `hooks-editor.test.tsx` shows the `hiddenValue()` helper for reading what the form would
  submit. `src/components/settings/controls/json.test.tsx` shows `userEvent` usage (note its
  comment: `user.type` treats `{` as a key descriptor, so a literal brace is typed as `{{`).
- Pure-logic tests live next to the module as `*.test.ts` and use
  `import { describe, expect, test } from "bun:test"`.

## Commands you will need

| Purpose       | Command                                 | Expected on success                                           |
| ------------- | --------------------------------------- | ------------------------------------------------------------- |
| Install       | `bun install`                           | exit 0 (already installed; only if `node_modules` is missing) |
| Typecheck     | `bun run typecheck`                     | `tsc --noEmit`, exit 0, no output                             |
| Lint          | `bun run lint`                          | exit 0                                                        |
| One test file | `bun test src/lib/config/hooks.test.ts` | `N pass, 0 fail`                                              |
| All tests     | `bun test`                              | `0 fail` (302 pass at the planned-at commit)                  |

## Suggested executor toolkit

- Read `AGENTS.md` first: this repo's Next.js differs from what you know; the guide index is
  at `node_modules/next/dist/docs/index.md`. This plan touches no routing or Server Action
  code, but the rule stands.
- The hooks reference: https://code.claude.com/docs/en/hooks.md (append `.md` for markdown).

## Scope

**In scope** (the only files you should modify):

- `src/lib/config/hooks.ts`
- `src/lib/config/hooks.test.ts`
- `src/lib/config/validate.test.ts` (add cases; do not restructure)
- `src/components/settings/controls/hooks-editor.tsx`
- `src/components/settings/controls/hooks-editor.test.tsx`
- `docs/verified-file-formats.md` (add a section and a table row)

**Out of scope** (do NOT touch, even though they look related):

- `src/lib/config/validate.ts` — the dispatch on `setting.key === "hooks"` already calls
  `validateHooksObject`; keep the name and signature so no edit is needed here.
- `src/lib/config/value-form.ts` — hooks are already parsed as JSON.
- `src/lib/catalog/hooks.ts`, `src/lib/catalog/hooks.data.json` — generated catalog data; never hand-edit.
- `src/lib/config/actions.ts`, `src/lib/config/mutate*.ts` — the write path is correct.
- Plugin `hooks/hooks.json` files — a different file, same shape, not read by Boopervisor.

## Git workflow

- Branch: `advisor/001-hooks-documented-shape`
- Commit per step or logical unit. Message style is a plain imperative sentence, no prefix, e.g.
  `Let the hooks editor set a command, and the JSON editor refuse bad JSON` (from `git log`).
- Pre-commit hooks run Prettier via lint-staged; let them.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Rewrite the model in `src/lib/config/hooks.ts` around the documented shape

Replace the types and the three functions. Target shape:

```ts
/** One action Claude Code runs. Only `command` hooks are edited as a form; the rest are preserved as found. */
export interface HookAction {
  type: string;
  command?: string;
  timeout?: number;
  [field: string]: unknown;
}

/** A `{ matcher, hooks }` group. `matcher` is optional: absent or "*" means every occurrence. */
export interface HookGroup {
  matcher?: string;
  hooks: HookAction[];
  [field: string]: unknown;
}

export type HooksByEvent = Record<string, HookGroup[]>;

export type ParseHooksResult =
  { ok: true; hooks: HooksByEvent } | { ok: false; problem: string };

export function parseHooksObject(value: unknown): ParseHooksResult;
export function validateHooksObject(value: unknown): ValidationResult;
export function assembleHooksObject(
  hooks: HooksByEvent
): Record<string, unknown>;
```

Rules `parseHooksObject` enforces (each failure returns `{ ok: false, problem }` naming the
event and, where possible, the group index — e.g. `` `hooks.PreToolUse[1] must have a "hooks" array.` ``):

1. The value must be a plain object keyed by event. `undefined` and `{}` both parse to `{}`.
2. Each event's value must be an array. An event the catalog does not know
   (`isUnknownHookEvent` from `@/lib/catalog/hooks`) is **accepted and preserved**; do not
   refuse it.
3. Each group must be a plain object with a `hooks` array. `matcher`, when present, must be a string.
4. Each hook must be a plain object with a string `type`.
5. When `type === "command"`, `command` must be a non-empty string, and `timeout`, when present, a finite number.
6. Every other field on a group or a hook is kept exactly as found (spread it through).
7. A flat entry (`{ matcher, command }` with no `hooks` array) is refused with a message that
   names the documented shape, e.g. `` `hooks.SessionStart[0] is not a { "matcher", "hooks" } group.` ``

`validateHooksObject` returns `parseHooksObject`'s failure as a `ValidationResult`, or `{ ok: true }`.
Remove `validateHookEntry` and `HookEntry` (nothing outside this file and its test imports them —
confirm with the grep in the verify line).

`assembleHooksObject` returns the object to write: drops an event whose group list is empty,
drops a group whose `hooks` is empty, omits `matcher` when it is the empty string, and keeps
every other field. `assembleHooksObject(parseHooksObject(x).hooks)` must deep-equal `x` for
any valid `x` whose groups all have at least one hook and whose matchers are non-empty.

**Verify**: `grep -rn "validateHookEntry\|HookEntry\b" src --include='*.ts' --include='*.tsx'` → only matches inside `src/lib/config/hooks.ts` / `hooks.test.ts` (which you are rewriting) — then `bun run typecheck` → exit 0 (the editor will fail to typecheck until Step 3 if it references removed names; if so, proceed to Step 3 before re-running typecheck).

### Step 2: Rewrite `src/lib/config/hooks.test.ts`

Replace the file's contents. Cases (each a `test`), grouped in `describe` blocks for
`parseHooksObject`, `validateHooksObject`, `assembleHooksObject`:

- accepts a documented value:
  `{ SessionStart: [{ hooks: [{ type: "command", command: "/x.sh", timeout: 30 }] }] }` →
  `ok: true`, and `hooks.SessionStart[0].hooks[0].timeout === 30`.
- accepts a matcher on a tool event: `{ PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo hi" }] }] }`.
- preserves a non-command hook and its fields: `{ Stop: [{ hooks: [{ type: "prompt", prompt: "Check", model: "haiku" }] }] }` → parse ok and `assemble(parse(x).hooks)` deep-equals `x`.
- preserves an unknown field on a group and on a hook (e.g. `{ hooks: [...], note: "kept" }`).
- accepts an event the catalog does not list (e.g. `SomethingNew`) and keeps it.
- **regression**: refuses the flat shape `{ SessionStart: [{ matcher: "", command: "/x.sh" }] }` with a problem mentioning `hooks`.
- refuses a command hook without `command`, with `problem` naming the event.
- refuses a hook without a string `type`.
- refuses a non-number `timeout`.
- refuses a non-array event value and a non-object top level.
- `undefined` and `{}` parse to `{}`.
- `assembleHooksObject` drops empty events and empty groups and omits an empty-string matcher.
- round-trip: the real-world value
  `{"SessionStart":[{"hooks":[{"type":"command","command":"python3 ~/.claude/hooks/x.py","timeout":30}]}]}`
  survives `assemble(parse(x).hooks)` unchanged (`toEqual`).

**Verify**: `bun test src/lib/config/hooks.test.ts` → all pass, 0 fail.

### Step 3: Rewrite the editor in `src/components/settings/controls/hooks-editor.tsx`

Keep the component name `HooksEditorControl` and its prop `{ value: unknown }` — the
registry in `src/components/settings/controls/index.ts` depends on both. Keep the
`scriptPath` helper and its "Runs `<path>`. Boopervisor never writes that file" note. Keep the
hidden `<input type="hidden" name="value" …>`.

Behaviour:

1. **Unparseable value → JSON fallback, never an empty editor.** If `parseHooksObject(value)`
   is not ok, render:
   - a `<p role="alert">` saying the hooks in this file are not in the shape Boopervisor can
     edit as a form, quoting `problem`, and that the value is shown as JSON instead;
   - the existing `JsonControl` from `./json` with `value={value}` (it renders its own
     `name="value"` textarea, so do **not** also render the hidden `value` input in this branch).
     This is the rule that prevents the wipe. There is no third option.
2. Otherwise, state is `HooksByEvent` (from Step 1), initialised from the parse. Render every
   event in `HOOK_EVENTS` order, then any event present in the value that the catalog does
   not know, each labelled with `Badge tone="warning"` text "Not in the catalog" (import
   `Badge` from `@/components/ui/badge`).
3. Per event: an "Add group" button appends `{ matcher: "", hooks: [] }`. Per group: a
   `matcher` `Input` (placeholder `Tool name or pattern, e.g. Bash or Edit|Write. Blank means every occurrence.`),
   a "Remove group" button, and the group's hooks.
4. Per hook: when `type === "command"`, an `Input` for `command` (class `font-mono`) and an
   `Input type="number"` for `timeout` (seconds; blank removes the field), plus "Remove hook".
   When `type` is anything else, render the hook as `<pre>` JSON (same classes as the
   `Configuration` block in `src/app/mcp/mcp-server-list.tsx:191`) with the note
   `A <type> hook. Boopervisor edits command hooks as a form; edit this one as JSON.` and a
   "Remove hook" button. Never mutate a non-command hook's object in state.
5. Per group: an "Add command hook" button appends `{ type: "command", command: "" }`.
6. The hidden field's value is `JSON.stringify(assembleHooksObject(state))`.

Remove the unused `errors` state and `HookEntryUI`.

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step 4: Rewrite `src/components/settings/controls/hooks-editor.test.tsx`

Keep the `hiddenValue()` helper. Cases:

- renders events from the catalog when `value` is `undefined` (keep the existing test).
- given a documented value, the command appears in a textbox:
  `{ SessionStart: [{ hooks: [{ type: "command", command: "/path/to/setup.sh" }] }] }`.
- editing the command updates the hidden field to the nested shape:
  after typing, `JSON.parse(hiddenValue())` deep-equals `{ SessionStart: [{ hooks: [{ type: "command", command: "<new>" }] }] }`.
- "Add group" then "Add command hook" then typing a command yields a nested group in the hidden field.
- a `prompt` hook is shown read-only and survives untouched in the hidden field after a command hook in the same group is edited.
- **regression**: given the flat value `{ SessionStart: [{ matcher: "", command: "/x.sh" }] }`,
  a `role="alert"` is rendered, and the only `name="value"` control's value is the original JSON
  (`JSON.parse(hiddenValue-or-textarea)` deep-equals the input) — i.e. nothing was emptied.
  (`hiddenValue()` queries a hidden input; in this branch the control is the JSON textarea, so
  query `textarea[name="value"]` instead.)
- an unknown event in the value is rendered with the "Not in the catalog" badge.

**Verify**: `bun test src/components/settings/controls/hooks-editor.test.tsx` → all pass.

### Step 5: Add `validateSetting` cases in `src/lib/config/validate.test.ts`

Find the existing `describe` for hooks in that file (search for `"hooks"`), and add or
replace cases so that, with `getSetting("hooks")!` as the definition:

- the nested value from Step 2's first case → `{ ok: true }`;
- the flat value → `ok: false` with a `problem` mentioning `hooks`.

If the file has no hooks cases, add a `describe("validateSetting for hooks", …)` block
modelled on the file's other blocks.

**Verify**: `bun test src/lib/config/validate.test.ts` → all pass.

### Step 6: Record the shape in `docs/verified-file-formats.md`

Add a section `## The hooks key` after `## The settings keys that disable an item`, in the
document's voice (see its opening paragraphs), saying: the shape is three levels
(event → `{ matcher, hooks }` groups → actions with a `type`); `command` hooks carry `command`,
optional `timeout` in seconds and `async`; other types (`prompt`, `agent`, `http`, `mcp_tool`)
are preserved and shown read-only; source https://code.claude.com/docs/en/hooks. Add a row to
the `## What this changed` table:

| `hooks` is a flat list of `{ matcher, command }` per event | **Wrong.** Groups carry a `hooks` array of typed actions; a flat entry is refused, and a value the parser cannot read is shown as JSON rather than replaced. Corrected. |

**Verify**: `grep -n "## The hooks key" docs/verified-file-formats.md` → one match.

### Step 7: Full gates

**Verify**: `bun run typecheck` → 0; `bun run lint` → 0; `bun test` → 0 fail.

## Test plan

Covered by Steps 2, 4 and 5. The structural patterns: `src/lib/config/permissions.test.ts`
for the parser tests, `src/components/settings/controls/json.test.tsx` and the existing
`hooks-editor.test.tsx` for the component tests. Verification: `bun test` → 0 fail, and the
two regression cases ("refuses the flat shape", "unparseable value renders the JSON fallback
with the original value") exist by those names or close paraphrases.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun test` exits 0
- [ ] `grep -n "command: entry.command" src/components/settings/controls/hooks-editor.tsx` → no matches
- [ ] `grep -n "validateHookEntry" src/lib/config/hooks.ts` → no matches
- [ ] `grep -c "hooks: \[" src/lib/config/hooks.test.ts` → at least 5
- [ ] `grep -n "## The hooks key" docs/verified-file-formats.md` → one match
- [ ] `git status --porcelain` lists only in-scope files (and `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- `src/lib/catalog/settings.data.json`'s `hooks` entry `typeText` no longer describes
  `{ "matcher", "hooks" }` groups — the catalog was regenerated against a changed reference.
- `parseValueForSetting` in `src/lib/config/value-form.ts` no longer parses `hooks` as JSON
  (the editor's hidden field contract would have changed).
- `CONTROL_REGISTRY` in `src/components/settings/controls/index.ts` no longer maps `hooks` to
  `HooksEditorControl`.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Only `command` hooks are edited as a form. If a form for `prompt` or `http` hooks is wanted
  later, extend the per-hook branch in the editor; the parser already preserves their fields.
- Reviewer: check the JSON-fallback branch by hand — give the editor a flat value and confirm
  Save would submit the original JSON, not `{}`. That branch is the safety property.
- `HOOK_EVENTS` comes from a regenerated file; an event added to the docs appears in the editor
  after `bun run catalog:hooks` and a commit of the data file. Unknown events already on disk are
  preserved regardless.
- Deferred: matcher syntax help per event (which events accept a matcher is documented but not
  modelled here), and validating `type`-specific fields for non-command hooks.
