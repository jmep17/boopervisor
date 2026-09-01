# Plan 006: Each setting shows what the catalog knows about it, and a dangerous setting asks before it is written

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 69744da..HEAD -- src/components/settings/setting-row.tsx src/components/settings/setting-details.tsx src/components/settings/setting-details.test.tsx src/components/settings/confirm-write-dialog.tsx src/components/settings/confirm-write-dialog.test.tsx docs/PLAN.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW — display plus a confirmation step; the write path is untouched.
- **Depends on**: 001 (the hooks editor is one of the dangerous controls; land its fix first so the confirmation is tested against the corrected editor)
- **Category**: direction
- **Planned at**: commit `69744da`, 2026-08-30

## Why this matters

The catalog is hand-maintained precisely so the interface can say things a settings file
cannot (ADR 0003: "It also leaves nowhere to hang the things only we know: which control
renders a key, how to group it, which keys are dangerous enough to warrant a confirmation").
Today most of that is extracted and then never shown:

- Every one of the 217 entries in `src/lib/catalog/settings.data.json` has `typeText`,
  `defaultText` and `docUrl`; 42 have a non-empty `perSessionOverrides` — the reference's own
  sentence about which environment variable or CLI flag takes precedence over the key for one
  session (e.g. `autoConnectIde`: "`CLAUDE_CODE_AUTO_CONNECT_IDE` takes precedence over this
  key for one session, in either direction"). None of the four is rendered anywhere under
  `src/components/`.
- Nine keys carry `dangerous: true` in `src/lib/catalog/overrides.ts` — `hooks`, `statusLine`,
  `apiKeyHelper`, `awsAuthRefresh`, `permissions.defaultMode`, `disableAllHooks`,
  `strictPluginOnlyCustomization` and others — each with a `note` explaining why. Nothing
  reads the flag: Save writes immediately.

The README promises Boopervisor "shows you what Claude Code will actually do" with its
files. An effective value that an environment variable overrides for the session is the
sharpest case of that promise, and the catalog already holds the sentence.

After this plan: a setting's detail panel shows its type, default, the per-session override
sentence when the reference gives one, and a link to the reference; and a dangerous
setting's Save opens a confirmation naming the key and the catalog's reason before the
form submits.

## Current state

`src/lib/catalog/types.ts:1203-1214` — what every entry carries:

```ts
export type ExtractedSetting = {
  key: string;
  topic: string;
  summary: string;
  scopes: Scope[];
  valueType: ValueType;
  enumValues: string[];
  typeText: string;
  defaultText: string;
  perSessionOverrides: string;
  docUrl: string;
};
```

`src/lib/catalog/types.ts:1239-1247` — `SettingDefinition` adds `dangerous: boolean` and
`overrideNote?: string` (the `note` from `overrides.ts`).

`src/components/settings/setting-row.tsx:796-819` — the detail panel today (per-scope
breakdown only):

```tsx
      <div className="flex flex-col gap-4 border-t border-gray-alpha-400 px-4 py-4">
        <dl className="flex flex-col gap-1 text-xs">
          {(Object.keys(SCOPE_LABELS) as Scope[])
            .filter((scope) => scope in perScope)
            .map((scope) => (
```

`src/components/settings/setting-row.tsx:848-863` — the buttons:

```tsx
<div className="flex items-center gap-2">
  <Button type="submit" disabled={pending}>
    {pending ? "Saving" : "Save"}
  </Button>
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

`SettingRow` is `"use client"` and calls `useActionState(writeSetting, {})`; the form is
`<form action={submit}>`. There is no `setting-row.test.tsx` — because the component imports
a Server Action directly, the repo's pattern is to test a _view_ component that receives
behaviour as props (`ScopeSwitcherView` in `src/components/scope-switcher.tsx` and its test)
or a leaf component (`src/components/ui/dialog.test.tsx`). Follow that: put the new UI in two
leaf components with their own tests, and keep the edit to `SettingRow` small.

A confirmation dialog already exists in the codebase — `src/components/history/history-row.tsx:1274-1310`
(`Dialog`, `DialogContent`, `DialogTitle`, `DialogDescription`, `DialogFooter` from
`src/components/ui/dialog`, with Cancel and a primary button).

Sample values from the data file, to shape the copy:

- `hooks`: `defaultText` "unset, so no hooks run"; `overrideNote` "Structured, event-keyed, and executes shell commands. Warrants its own editor and a confirmation."
- `apiKeyHelper`: `overrideNote` "Runs a command of the user's choosing to produce credentials."
- `autoCompactWindow`: `perSessionOverrides` "`--autocompact` takes precedence over this key for one session, and `CLAUDE_CODE_AUTO_COMPACT_WINDOW` takes precedence over both".
- Empty `perSessionOverrides` is `""`; treat `""` and `"—"` as none.

A caution on precedence: https://code.claude.com/docs/en/env-vars.md says in general
"Settings files override shell variables", while the per-key reference sentences above say
the opposite for specific keys. Do not reconcile them; show the reference's per-key sentence
verbatim, introduced as what the reference says.

Conventions: Geist tokens only (`text-gray-900` secondary text, `text-gray-1000` primary,
`font-mono` for keys and values); `Badge` from `src/components/ui/badge`; copy in the voice
of the existing UI ("Managed settings belong to whoever administers this machine.").
Vocabulary (`CONTEXT.md`): **setting**, **effective value**, **winning scope**, **mutation**.

## Commands you will need

| Purpose   | Command                                                     | Expected |
| --------- | ----------------------------------------------------------- | -------- |
| Typecheck | `bun run typecheck`                                         | exit 0   |
| Lint      | `bun run lint`                                              | exit 0   |
| One file  | `bun test src/components/settings/setting-details.test.tsx` | 0 fail   |
| All       | `bun test`                                                  | 0 fail   |

## Suggested executor toolkit

- `AGENTS.md` first. `SettingRow` is a client component using `useActionState`; see
  `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` for how forms and pending
  state work in this version before changing the buttons.

## Scope

**In scope**:

- `src/components/settings/setting-details.tsx` (create) + `setting-details.test.tsx` (create)
- `src/components/settings/confirm-write-dialog.tsx` (create) + `confirm-write-dialog.test.tsx` (create)
- `src/components/settings/setting-row.tsx`
- `docs/PLAN.md` (one sentence in the interface section)

**Out of scope**:

- `src/lib/catalog/**` — the data and overrides are correct; do not add fields.
- `src/lib/config/actions.ts` and the write path — the confirmation is in the browser only,
  which is enough: the server already validates, backs up and stale-checks.
- Uncatalogued rows (no `definition`) — nothing to show; they keep their current panel.
- The controls under `src/components/settings/controls/`.

## Git workflow

- Branch: `advisor/006-surface-catalog-knowledge`
- Plain imperative commit messages. Do NOT push or open a PR unless instructed.

## Steps

### Step 1: `SettingDetails`

Create `src/components/settings/setting-details.tsx` (no `"use client"` needed — no hooks,
no handlers):

```tsx
import type { SettingDefinition } from "@/lib/catalog";

/** The reference's own words about a setting, which no settings file can tell the user. */
export function SettingDetails({ definition }: { definition: SettingDefinition }) { … }
```

Render a `<dl className="flex flex-col gap-1 text-xs">` with rows (label `dt` in
`text-gray-900`, value `dd` in `text-gray-1000`):

- "Type" → `definition.typeText`
- "Default" → `definition.defaultText`
- "For one session" → `definition.perSessionOverrides`, rendered only when it is non-empty
  and not `"—"`, prefixed in the `dd` by the words "The reference says: " so the sentence is
  attributed, not asserted.
- "Reference" → `<a href={definition.docUrl} target="_blank" rel="noreferrer">` with the
  visible text being the URL's fragment or path (e.g. `settings-reference#autocompactwindow`),
  in `font-mono`.

Do not render backticks literally: the data uses Markdown code spans (`` `--autocompact` ``).
Add a tiny helper in the same file that splits on backticks and wraps odd segments in
`<code className="font-mono">`. Test it through the component.

Tests (`setting-details.test.tsx`, pattern `src/components/ui/badge.test.tsx`): use
`getSetting("autoCompactWindow")!` and `getSetting("verbose")!` from `@/lib/catalog` —

- shows Type and Default text;
- shows the "For one session" row for `autoCompactWindow` with `--autocompact` in a `<code>`;
- does not show that row for a key whose `perSessionOverrides` is empty (find one with
  `SETTINGS.find(s => !s.perSessionOverrides)`);
- the Reference link's `href` equals `definition.docUrl` and opens in a new tab.

**Verify**: `bun test src/components/settings/setting-details.test.tsx` → 0 fail.

### Step 2: `ConfirmWriteDialog`

Create `src/components/settings/confirm-write-dialog.tsx` (`"use client"`):

```tsx
export function ConfirmWriteDialog({
  open, onOpenChange, settingKey, reason, onConfirm, pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settingKey: string;
  /** The catalog's note on why this key warrants a confirmation. */
  reason?: string;
  onConfirm: () => void;
  pending?: boolean;
}) { … }
```

Body: `DialogTitle` "Write {settingKey}?"; `DialogDescription` = `reason` when given, else
"This setting changes what Claude Code will do without asking."; then one line "It is backed
up first and can be restored from History."; `DialogFooter` with Cancel (secondary) and
"Write it" (primary, calls `onConfirm`). Model the markup on `history-row.tsx:1274-1310`.

Tests (`confirm-write-dialog.test.tsx`, pattern `src/components/ui/dialog.test.tsx`):
renders the key in the title; renders the reason; clicking "Write it" calls `onConfirm`
once; clicking Cancel calls `onOpenChange(false)`.

**Verify**: `bun test src/components/settings/confirm-write-dialog.test.tsx` → 0 fail.

### Step 3: Wire both into `SettingRow`

In `src/components/settings/setting-row.tsx`:

- Render `<SettingDetails definition={definition} />` at the top of the detail panel, before
  the per-scope `<dl>`, when `definition` is present.
- Add `const formRef = useRef<HTMLFormElement>(null)` and `ref={formRef}` on the form; add
  `const [confirming, setConfirming] = useState(false)`.
- If `definition?.dangerous`: the Save button becomes `type="button"` with
  `onClick={() => setConfirming(true)}`; render `<ConfirmWriteDialog open={confirming}
onOpenChange={setConfirming} settingKey={key} reason={definition.overrideNote}
pending={pending} onConfirm={() => { setConfirming(false); formRef.current?.requestSubmit(); }} />`.
  Otherwise the button is unchanged. Unset never confirms (it returns the key to Claude Code's
  own default). Next to a dangerous key's summary in the `<summary>` line, add
  `<Badge tone="warning">Confirms before writing</Badge>` — short, so the row stays one line.

`requestSubmit()` fires the form's `action`, so `useActionState`'s pending and error state
still come from the form. Do not call the Server Action directly.

**Verify**: `bun run typecheck` → 0; `bun run lint` → 0; `bun test` → 0 fail. Then `bun dev`,
open `/settings`, expand `hooks` (or `apiKeyHelper`): the details rows are present, the
Reference link opens the docs, and Save opens the dialog; Cancel writes nothing (check
`/history`); "Write it" writes (then Unset to restore, or restore from History). Stop the server.

### Step 4: Record it

`docs/PLAN.md`, interface section, after the sentence about typed controls: add "A key the
catalog marks dangerous — one that runs a command or changes what Claude Code does unasked —
asks for confirmation before it is written; every key shows the reference's type, default and
per-session override alongside its value."

**Verify**: `grep -n "marks dangerous" docs/PLAN.md` → one match.

### Step 5: Full gates

**Verify**: `bun run typecheck` → 0; `bun run lint` → 0; `bun test` → 0 fail.

## Test plan

Steps 1 and 2 (leaf components, DOM tests). `SettingRow` itself stays untested by the DOM,
as today; the manual check in Step 3 covers the wiring. Verification: `bun test` → 0 fail
with the new test files present.

## Done criteria

- [ ] `bun run typecheck`, `bun run lint`, `bun test` exit 0
- [ ] `ls src/components/settings/setting-details.tsx src/components/settings/confirm-write-dialog.tsx` → both exist, each with a `.test.tsx` sibling
- [ ] `grep -n "perSessionOverrides" src/components/settings/setting-details.tsx` → at least one match
- [ ] `grep -n "definition?.dangerous\|definition.dangerous" src/components/settings/setting-row.tsx` → at least one match
- [ ] `grep -n "requestSubmit" src/components/settings/setting-row.tsx` → one match
- [ ] Manual check in Step 3 performed
- [ ] `git status --porcelain` lists only in-scope files (and `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Excerpts do not match the live code.
- `SettingDefinition` no longer carries `dangerous` / `overrideNote` / `perSessionOverrides`.
- `requestSubmit()` does not trigger the Server Action in this Next/React version (the form's
  `action` is not invoked) — report; do not switch to calling `writeSetting` by hand.
- Plan 001 is not DONE.
- A step's verification fails twice.

## Maintenance notes

- New dangerous keys are a one-line `dangerous: true` in `overrides.ts` with a `note`; the
  note is what the dialog shows, so write it for a user, not a maintainer.
- If the reference's Markdown ever uses more than code spans in `perSessionOverrides`, the
  backtick splitter will show it raw; that is acceptable, but a reviewer should glance at the
  42 sentences after any `bun run catalog:settings`.
- Deferred: a confirmation for dangerous _item_ changes (none are marked today), and
  rendering `scopes` ("which files may hold this key") — the row already implies it via the
  breakdown.

## Reconciliation (2026-09-01, HEAD `484309b`)

`src/components/settings/setting-row.tsx` was reworked by plans 008/009; the plan's intent
is unchanged but its excerpts were stale. Current state (verified 2026-09-01):

- Summary block (lines 51–79): responsive flex; the right-hand span
  (`flex min-w-0 items-center gap-2 sm:max-w-[50%] sm:shrink`) holds the truncated value
  and the badges, each `shrink-0`. Put the new
  `<Badge tone="warning" className="shrink-0">Confirms before writing</Badge>` in that span.
- Detail panel (lines 81–82): opens with
  `<div className="flex flex-col gap-4 border-t border-gray-alpha-400 px-4 py-4">` then
  `<dl className="flex flex-col gap-1 text-sm">`. Render `<SettingDetails …>` above that dl.
- Form and buttons (lines 112–148): substance matches the plan's excerpt (`useActionState`,
  Save/Unset buttons); no `useRef` exists yet.
- All prose in the component is now `text-sm` (plan 009). `SettingDetails` uses `text-sm`,
  not the plan's `text-xs`.
- `src/app/design-tokens.test.ts` (plans 007/009) bans non-Geist colour/radius classes and
  `text-gray-700/800` text. Both new components must pass it.
- `docs/PLAN.md` Step 4 anchor (the typed-controls sentence) is at lines 65–69, unchanged.
