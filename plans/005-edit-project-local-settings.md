# Plan 005: A project edit can land in `.claude/settings.local.json` as well as `.claude/settings.json`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 69744da..HEAD -- src/lib/config/editing-scope.ts src/lib/config/editing-scope.test.ts src/components/settings/settings-list.tsx src/components/settings/settings-file-switch.tsx src/app/settings/page.tsx docs/PLAN.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW — the write path already accepts the `local` scope; this adds a way to choose it.
- **Depends on**: none (003 is recommended first only so a manual check runs against localhost)
- **Category**: direction
- **Planned at**: commit `69744da`, 2026-08-30

## Why this matters

Boopervisor reads a project's two settings files and shows both in every per-scope
breakdown ("Project-local — wins"), and the Server Action that writes a setting accepts the
`local` scope. But no page ever asks for it: with a project selected, every edit goes to
`.claude/settings.json`. `.claude/settings.local.json` is the file Claude Code itself
writes permission approvals into, and the one the docs tell people to keep out of git for
personal overrides — it is the file a user most often wants to edit by hand today.

After this plan: when a project is selected, `/settings` offers the choice of which of the
project's two files an edit lands in, the choice travels in the URL like every other
listing filter in this app, and the row labels, stale-write token and "overridden" hint all
follow the chosen file.

## Current state

`src/components/settings/settings-list.tsx:606-616` — the editing scope is decided here:

```tsx
export async function SettingsList() {
  const selected = await getSelectedScope();
  const location: SettingsLocation = {
    projectRoot: selected.kind === "project" ? selected.path : undefined,
  };
  // A project's own settings are the ones worth editing; the user scope is the fallback.
  const editing: Scope = selected.kind === "project" ? "project" : "user";

  const { fileStatuses, parsed } = await resolveEffectiveSettings(location);
  const scopes = scopesFor(location);
  const expected = encodeExpectedFile(await snapshotScope(editing, location));
```

`src/app/settings/page.tsx:51-65` — the page takes no search params today:

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

`src/lib/config/actions.ts:28-35` — the action already permits `local`:

```ts
const scope = String(formData.get("scope") ?? "") as Scope;
if (scope !== "user" && scope !== "project" && scope !== "local") {
  return { error: "That scope cannot be written." };
}
if (scope !== "user" && selected.kind !== "project") {
  return { error: "Select a project before editing its settings." };
}
```

`src/components/settings/setting-row.tsx:832-834` labels the field from the scope:

```tsx
            <Field
              label={`Value in ${SCOPE_LABELS[editing].toLowerCase()} settings`}
```

`SCOPE_LABELS.local` is `"Project-local"` (`src/components/settings/scope-labels.ts`).
`isOverridden` in `src/lib/config/effective.ts:300-307` uses `PRECEDENCE`, where `local`
outranks `project`, so a local edit is only ever "overridden" by managed.

How the other pages carry a listing choice — `src/app/mcp/page.tsx:73-75`:

```tsx
/** Selection and the archived filter travel in the URL, so both survive a reload. */
export default async function McpPage({ searchParams }: PageProps<"/mcp">) {
  const { item, archived } = await searchParams;
```

and `src/components/items/master-detail.tsx:96-107` renders the toggle as a plain `Link`
to the same page with the parameter flipped. Match that: a `Link`, not client state.

Vocabulary (`CONTEXT.md`): **scope** — "One of the places Claude Code reads configuration
from: user, project, project-local, or managed." Use "project-local" in copy; never "local
override", "tier" or "level". `docs/PLAN.md` interface section: "Editing targets the selected
scope, and the breakdown makes it visible when a higher-precedence scope will override what
was just typed."

## Commands you will need

| Purpose    | Command             | Expected     |
| ---------- | ------------------- | ------------ |
| Typecheck  | `bun run typecheck` | exit 0       |
| Lint       | `bun run lint`      | exit 0       |
| Tests      | `bun test`          | 0 fail       |
| Dev server | `bun dev`           | manual check |

## Suggested executor toolkit

- Read `AGENTS.md`; then `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`
  for `PageProps` and `searchParams` (a Promise in this version — see `src/app/mcp/page.tsx`).

## Scope

**In scope**:

- `src/lib/config/editing-scope.ts` (create) and `src/lib/config/editing-scope.test.ts` (create)
- `src/components/settings/settings-list.tsx`
- `src/components/settings/settings-file-switch.tsx` (create)
- `src/app/settings/page.tsx`
- `docs/PLAN.md` (one sentence)

**Out of scope**:

- `src/lib/config/actions.ts` — already correct.
- `src/components/settings/setting-row.tsx` — already labels from `editing`.
- Items pages and `src/lib/items/actions.ts` — they hardcode the project scope for state
  changes; a separate plan if wanted.
- Any gitignore advice UI.

## Git workflow

- Branch: `advisor/005-edit-project-local-settings`
- Plain imperative commit messages. Do NOT push or open a PR unless instructed.

## Steps

### Step 1: A pure helper that decides the editing scope

Create `src/lib/config/editing-scope.ts`:

```ts
import type { Scope } from "@/lib/catalog";
import type { ScopeSelection } from "@/lib/scope/scope";

/** The `file` search parameter's values. Anything else reads as the project's own file. */
export type ProjectFile = "project" | "local";

export function parseProjectFile(
  value: string | string[] | undefined
): ProjectFile {
  return value === "local" ? "local" : "project";
}

/**
 * The scope an edit on /settings writes to. The user scope has one file; a project has two,
 * and the page's `file` parameter says which.
 */
export function editingScopeFor(
  selected: ScopeSelection,
  file: ProjectFile
): Scope {
  if (selected.kind !== "project") return "user";
  return file === "local" ? "local" : "project";
}
```

Tests in `editing-scope.test.ts` (pattern: `src/lib/scope/scope.test.ts`): user selection
always yields `user` whatever `file` is; project + `"project"` → `project`; project + `"local"`
→ `local`; `parseProjectFile` maps `"local"` → `"local"` and `undefined`, `"x"`, `["local"]` → `"project"`.

**Verify**: `bun test src/lib/config/editing-scope.test.ts` → 0 fail.

### Step 2: Thread the parameter from the page to the list

`src/app/settings/page.tsx`: make the component `async`, take `{ searchParams }: PageProps<"/settings">`,
`const { file } = await searchParams;`, and pass `file={parseProjectFile(file)}` to `SettingsList`.

`src/components/settings/settings-list.tsx`: accept `{ file }: { file: ProjectFile }` and
replace the `editing` line with `const editing = editingScopeFor(selected, file);`. Update the
comment above it to say a project has two files and the page's `file` parameter chooses.

**Verify**: `bun run typecheck` → 0.

### Step 3: The switch

Create `src/components/settings/settings-file-switch.tsx` — a server-safe component (no
`"use client"`, no hooks) rendering two `Link`s, styled like `master-detail.tsx`'s
"Show archived" link (`text-xs text-gray-900 underline-offset-2 hover:underline`, and the
current one `text-gray-1000` with `aria-current="true"`):

- "Project — .claude/settings.json" → `/settings` (no parameter)
- "Project-local — .claude/settings.local.json" → `/settings?file=local`

Props: `{ file: ProjectFile }`. Render it from `SettingsList` **only when** `selected.kind === "project"`,
directly under the "Settings files" section, with a one-line description:
"Edits on this page are written to the file chosen here. Project-local settings win over project settings."

**Verify**: `bun run typecheck` → 0; `bun run lint` → 0.

### Step 4: Record the behaviour

`docs/PLAN.md`, interface section, after "Editing targets the selected scope…": add
"For a project, the page also chooses which of its two files an edit lands in, `.claude/settings.json`
or `.claude/settings.local.json`; the choice travels in the URL."

**Verify**: `grep -n "settings.local.json" docs/PLAN.md` → at least one match in the interface section.

### Step 5: Manual check and gates

`bun dev`; select a project in the header; open `/settings?file=local`; expand any row: the
field label reads "Value in project-local settings"; Save a harmless key (e.g. `verbose`)
and confirm the project's `.claude/settings.local.json` changed and `.claude/settings.json`
did not (`git -C <project> status` if the project is a repo). Use a scratch project directory,
not this repo. Then `/history` shows the mutation with the "Project-local" badge. Stop the server.

**Verify**: `bun run typecheck` → 0; `bun run lint` → 0; `bun test` → 0 fail.

## Test plan

Step 1's unit tests. The switch is two links; if a component test is wanted, model it on
`src/components/app-header.test.tsx` (renders `AppHeaderNav` with a pathname and asserts
`aria-current`). Verification: `bun test` → 0 fail.

## Done criteria

- [ ] `bun run typecheck`, `bun run lint`, `bun test` exit 0
- [ ] `grep -n "editingScopeFor" src/components/settings/settings-list.tsx` → one match
- [ ] `grep -n 'file=local' src/components/settings/settings-file-switch.tsx` → one match
- [ ] `grep -n 'const editing: Scope = selected.kind === "project" ? "project" : "user"' src/components/settings/settings-list.tsx` → no matches
- [ ] Manual check in Step 5 performed on a scratch project
- [ ] `git status --porcelain` lists only in-scope files (and `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Excerpts do not match the live code.
- `writeSetting` no longer accepts `"local"`.
- `PageProps<"/settings">` does not typecheck (the route type helper changed) — report rather than casting.
- A step's verification fails twice.

## Maintenance notes

- Items pages still write state changes to the project file only. If that is extended, reuse
  `editingScopeFor` and the same `file` parameter so both pages agree.
- Reviewer: confirm `expected` (the stale-write token) is computed for the chosen scope —
  it is, via `snapshotScope(editing, location)`, as long as `editing` is the only thing changed.

## Reconciliation (2026-09-01, HEAD `484309b`)

Drift since `69744da` reviewed by the advisor; the plan stands. Deltas:

- `src/app/settings/page.tsx` (plan 010): the `p-6` wrapper is gone and the Suspense
  fallback is now `<p className="text-sm text-gray-900">Reading settings…</p>`. Keep both
  as they are while making the component async and threading `searchParams` (Step 2).
- `src/components/settings/settings-list.tsx`: the `editing` decision is at lines 37–38,
  verbatim as excerpted; the render sections around it now use `text-sm` and responsive
  classes (plans 008/009). Only the `editing` decision changes.
- Step 3's styling model: `master-detail.tsx`'s "Show archived" link is now
  `text-sm text-gray-900 underline-offset-2 hover:underline` (plan 009). Use `text-sm`,
  not `text-xs`, for the switch.
- `docs/PLAN.md` Step 4 anchor ("Editing targets the selected scope…") is at line 62,
  unchanged. The file's only drift is plan 002's backup-naming sentence.
- `src/app/design-tokens.test.ts` (plans 007/009) bans non-Geist colour/radius classes and
  `text-gray-700/800` text. The switch must pass it.
