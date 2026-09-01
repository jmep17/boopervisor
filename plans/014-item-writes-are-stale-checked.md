# Plan 014: Enabling, disabling or archiving an item is stale-checked, and never half-applied

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9372dd4..HEAD -- src/lib/items/set-state.ts src/lib/items/actions.ts src/app/skills/skill-list.tsx src/app/plugins/plugin-list.tsx src/app/mcp/mcp-server-list.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — this changes the write path for every skill, plugin and MCP server toggle.
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `9372dd4`, 2026-09-01

## Why this matters

A **stale write** is defined in `CONTEXT.md` as "a mutation whose target file
changed on disk after Boopervisor read it. Boopervisor refuses these rather than
overwriting a change it never saw." Refusing them is one of the three things
Boopervisor exists to do — `docs/adr/0001-write-config-files-directly.md` gives
"a refusal when the file moved under us" as a reason to write files directly
instead of shelling out to the `claude` CLI.

Settings writes honour it: the form carries a token describing the file the page
read, and `mutateJsonFile` refuses if the file no longer matches. **Item state
changes do not.** `setItemState` takes a fresh snapshot of the file
_immediately before writing it_ and passes that as the "expected" state, so the
check compares the file to itself and can never fail. Claude Code writes to
`~/.claude/settings.json` and `~/.claude.json` while it runs; a user who
archives a skill in a stale browser tab silently reverts whatever Claude Code
wrote in between. The module's own doc comment (`set-state.ts:26-28`) claims the
opposite: "Both go through the shared write path, so both are validated, backed
up and stale-checked."

The same function also makes **two independent writes** — Claude Code's disable
key in a settings file, then Boopervisor's archive record in
`~/.claude/boopervisor.json` — with no check that the second can succeed before
the first is committed. When the second fails, the user gets an error and is
left with an item that is disabled but not archived; nothing says so.

After this plan: an item toggle carries the same expected-file token a settings
edit does and is refused when either file moved; and both files are checked
before either is written, so the common failure stops happening mid-way.

## Current state

Files:

- `src/lib/items/set-state.ts` (150 lines) — `setItemState`, the shared write path for all three item types. Both defects are here.
- `src/lib/items/actions.ts` (65 lines) — the `changeItemState` Server Action; reads the form, resolves the scope from the cookie, calls `setItemState`.
- `src/app/skills/skill-list.tsx`, `src/app/plugins/plugin-list.tsx`, `src/app/mcp/mcp-server-list.tsx` — server components that render the controls. Each already computes `location` and `scope`.
- `src/components/items/item-state-controls.tsx` — the client form. **It needs no change**: it renders `fields` as hidden inputs generically (`:41-43`).

`src/lib/items/set-state.ts:29-100`, the defect (note lines 97 and 111):

```ts
export async function setItemState({
  type,
  name,
  state,
  scope,
  location,
  source,
}: {
  type: ItemType;
  name: string;
  state: ItemState;
  /** The scope the header selects, which is where a disable is written. */
  scope: Scope;
  location: SettingsLocation;
  /** For an MCP server, where it is defined. Chooses the disabling mechanism. */
  source?: McpSource;
}): Promise<{ error?: string }> {
  const archived = state === "archived";
  const disable = archived || state === "disabled";

  const settingsProblem = await writeDisabled(
    type,
    name,
    scope,
    location,
    disable,
    source
  );
  if (settingsProblem) return { error: settingsProblem };

  const archivalProblem = await writeArchived(
    type,
    archivalName(name, source),
    scope,
    location,
    archived
  );
  return archivalProblem ? { error: archivalProblem } : {};
}
```

```ts
const result = await mutateSetting({
  scope,
  location,
  key: mechanism.key,
  value: next,
  expected: await snapshotScope(scope, location), // <- line 97: taken now, not what the page read
});
```

and in `writeArchived`:

```ts
  const path = archivedItemsPath(location.homeDir);
  const snapshot = await captureFileSnapshot(path);   // <- line 111: same problem
  ...
  const result = await mutateJsonFile({
    path,
    expected: snapshot,
```

For contrast, `src/lib/config/actions.ts:40-54` — how a settings write does it
correctly, taking the token from the form:

```ts
const result = await mutateSetting({
  scope,
  location,
  key,
  value: parsed.value,
  expected: decodeExpectedFile(String(formData.get("expected") ?? "")),
});
```

The token format, `src/lib/config/mutate.ts:43-60`:

```ts
export interface ExpectedFile {
  hash: string;
  mtimeMs: number;
}

/** The two fields as a form value, and back. Anything unreadable fails the stale check. */
export function encodeExpectedFile(snapshot: ExpectedFile): string {
  return `${snapshot.mtimeMs}:${snapshot.hash}`;
}

export function decodeExpectedFile(value: string | undefined): ExpectedFile {
  const separator = (value ?? "").indexOf(":");
  if (separator === -1) return { hash: "", mtimeMs: -1 };
  ...
}
```

`decodeExpectedFile` on a missing or malformed value yields
`{ hash: "", mtimeMs: -1 }`, which can never match a real file — a missing
token therefore fails safe, as a refusal. Rely on that; do not add a special
case.

`src/lib/items/actions.ts:47-60`, the part that calls through:

```ts
const selected = await getSelectedScope();
const location: SettingsLocation = {
  projectRoot: selected.kind === "project" ? selected.path : undefined,
};
const scope = selected.kind === "project" ? "project" : "user";

const result = await setItemState({
  type,
  name,
  state,
  scope,
  location,
  source,
});
```

`src/app/skills/skill-list.tsx:78-82`, one of the three call sites:

```tsx
          <ItemStateControls
            state={skill.state}
            action={changeItemState}
            fields={{ type: "skill", name: skill.name }}
```

`src/components/items/item-state-controls.tsx:41-43` — why the three call sites
need no component change:

```tsx
{
  Object.entries(fields).map(([name, value]) => (
    <input key={name} type="hidden" name={name} value={value} />
  ));
}
```

The two files a toggle touches:

- the settings file for the selected scope — `settingFilePath(scope, location)` from `@/lib/config/settings`
- Boopervisor's own file — `archivedItemsPath(location.homeDir)` from `@/lib/items/item-state`, i.e. `~/.claude/boopervisor.json`

### Conventions to match

- **Result objects, never thrown errors.** `setItemState` returns
  `{ error?: string }`; `mutateJsonFile` returns a discriminated
  `MutationResult` (`src/lib/config/mutate.ts:21-34`). Keep both shapes.
- **Vocabulary** (`CONTEXT.md`, quoted — the executor has not read it):
  - "**Stale write**: A mutation whose target file changed on disk after Boopervisor read it. Boopervisor refuses these rather than overwriting a change it never saw. _Avoid_: Conflict, race, dirty write"
  - "**Item state**: Exactly one of enabled, disabled, or archived."
  - "**Archived**: An item Boopervisor hides from the main listing and holds disabled. Archival is Boopervisor's own concept, recorded in Boopervisor's own file."
- **`docs/adr/0002-archival-is-boopervisors-own-state.md` constrains this work**:
  archival stays additive — "Claude Code's own files are always complete and
  always valid, with or without us". Do not merge the two writes into one file
  or move archival into Claude Code's files.
- **Tests use real temporary directories**, never mocks. See
  `src/lib/items/set-state.test.ts` as it stands, and `src/lib/config/mutate.test.ts:27-37`.
  Never call a function that defaults to `homedir()` without passing a
  temporary directory: plan 002 exists because tests once wrote into the real
  `~/.claude`.

## Commands you will need

| Purpose   | Command                                    | Expected on success |
| --------- | ------------------------------------------ | ------------------- |
| Install   | `bun install`                              | exit 0              |
| Typecheck | `bun run typecheck`                        | exit 0, no output   |
| Lint      | `bun run lint`                             | exit 0              |
| Tests     | `bun test`                                 | all pass, 0 fail    |
| One file  | `bun test src/lib/items/set-state.test.ts` | all pass, 0 fail    |

A fresh worktree has no `node_modules`: run `bun install` first.

## Scope

**In scope**:

- `src/lib/items/set-state.ts`
- `src/lib/items/set-state.test.ts`
- `src/lib/items/actions.ts`
- `src/app/skills/skill-list.tsx`
- `src/app/plugins/plugin-list.tsx`
- `src/app/mcp/mcp-server-list.tsx`

**Out of scope** (do NOT touch):

- `src/components/items/item-state-controls.tsx` — `fields` already renders
  arbitrary hidden inputs; changing it is unnecessary and would drag its tests in.
- `src/lib/config/mutate.ts`, `src/lib/config/mutate-setting.ts` — the shared
  write path is correct; only its callers pass the wrong `expected`.
- `src/lib/items/mechanism.ts` — the disabling mechanisms are correct.
- `src/lib/config/mcp-mutations.ts` — dead code, handled by plan 015.
- Making the two writes atomic across both files. That is not achievable
  without a change ADR 0002 forbids; this plan pre-checks instead.

## Git workflow

- Branch: `advisor/014-item-writes-are-stale-checked`
- Commit per step. Message style, from `git log`: one imperative sentence, no
  type prefix, e.g. `Replace Bun.file().exists() with node:fs/promises access so saves work under Node`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Take the expected tokens as arguments

In `src/lib/items/set-state.ts`, add two required fields to the `setItemState`
argument object:

```ts
/** What the settings file looked like when the page read it. */
expectedSettings: ExpectedFile;
/** What `~/.claude/boopervisor.json` looked like when the page read it. */
expectedArchive: ExpectedFile;
```

Import `type ExpectedFile` from `@/lib/config/mutate`. Thread them to
`writeDisabled` and `writeArchived` respectively, replacing
`expected: await snapshotScope(scope, location)` at line 97 with
`expected: expectedSettings`, and `expected: snapshot` at the `mutateJsonFile`
call with `expected: expectedArchive`.

`writeArchived` still needs to _read_ the archive file to decide whether the
record must change (`if (archived === key in existing) return undefined;`) —
keep that read, but stop using its snapshot as the expected state.

Correct the doc comment at `set-state.ts:19-28` so it describes what the code
now does.

**Verify**: `bun run typecheck` → fails, listing the call sites in
`src/lib/items/actions.ts` and the existing tests that do not pass the new
fields. That is the expected intermediate state; step 2 and step 4 fix them.

### Step 2: Refuse before writing, not between writes

Still in `set-state.ts`, before either write, capture both files and compare
them to the tokens. Add a helper in this file:

```ts
/**
 * Both files a state change touches, checked before either is written. Two files cannot be
 * written atomically, so the refusal happens while nothing has been touched: a stale token
 * that would have failed the second write no longer leaves the first one applied.
 */
async function refuseIfStale(...): Promise<string | undefined>
```

It captures `settingFilePath(scope, location)` (import from
`@/lib/config/settings`) and `archivedItemsPath(location.homeDir)` with
`captureFileSnapshot`, and returns a message when either `hash` or `mtimeMs`
differs from the matching token. Reuse the wording `mutateJsonFile` already
uses (`src/lib/config/mutate.ts:96-102`):

```
`${path} changed on disk after Boopervisor read it. Reload and try again.`
```

Check only the file each part of the change will actually write: a plain
enable/disable does not write the archive file, so do not refuse on its token
when `state` is not `archived` and the item is not currently archived. Keep
this simple — if in doubt, check both; a spurious refusal is safe, a missed one
is not.

`setItemState` calls it first and returns `{ error }` when it reports a problem.
Leave the individual `mutateJsonFile` / `mutateSetting` stale checks in place —
they are the real guard; this is the pre-flight that stops a half-applied change.

**Verify**: `bun run typecheck` → still only the call-site errors from step 1.

### Step 3: Pass the tokens from the form and from the pages

1. In `src/lib/items/actions.ts`, read both tokens from the form with
   `decodeExpectedFile` (import from `@/lib/config/mutate`), exactly as
   `src/lib/config/actions.ts:53` does, and pass them to `setItemState`:

   ```ts
     expectedSettings: decodeExpectedFile(String(formData.get("expectedSettings") ?? "")),
     expectedArchive: decodeExpectedFile(String(formData.get("expectedArchive") ?? "")),
   ```

2. In each of `src/app/skills/skill-list.tsx`, `src/app/plugins/plugin-list.tsx`
   and `src/app/mcp/mcp-server-list.tsx` — all three are server components —
   capture the two snapshots once per render, next to where `resolution` is
   computed:

   ```ts
   const expectedSettings = encodeExpectedFile(
     await captureFileSnapshot(settingFilePath(scope, location))
   );
   const expectedArchive = encodeExpectedFile(
     await captureFileSnapshot(archivedItemsPath())
   );
   ```

   and add them to the `fields` prop of every `ItemStateControls`:

   ```tsx
     fields={{ type: "skill", name: skill.name, expectedSettings, expectedArchive }}
   ```

   `mcp-server-list.tsx` already passes a `source` field — keep it.
   `fields` is typed `Record<string, string>`, so the encoded strings fit as they are.

**Verify**:

- `bun run typecheck` → exit 0.
- `bun run lint` → exit 0.
- `grep -rn "expectedSettings" src/app | wc -l` → 6 or more (two per list component).

### Step 4: Test the refusal

Extend `src/lib/items/set-state.test.ts`. Existing tests must be updated to pass
the new fields — get a valid token with
`encodeExpectedFile`/`captureFileSnapshot` on the temporary home's files, or
build `{ hash, mtimeMs }` from `captureFileSnapshot` directly (a `FileSnapshot`
satisfies `ExpectedFile`).

New cases:

- a state change succeeds when both tokens match the files
- a state change is refused when the settings file changed after the token was taken (write to the file between capturing the snapshot and calling `setItemState`), and the error mentions the path
- a state change is refused when `~/.claude/boopervisor.json` changed after its token was taken
- **the regression that matters**: when the archive file is stale, the settings
  file is left untouched — read the settings file after the refused archival and
  assert its bytes are unchanged
- a token that is empty or malformed is refused (pass `decodeExpectedFile(undefined)`)

**Verify**: `bun test src/lib/items/set-state.test.ts` → all pass, 0 fail.

### Step 5: Full gates

**Verify**: `bun test` → 0 fail (350 passed at `9372dd4`, plus your new ones);
`bun run typecheck` → exit 0; `bun run lint` → exit 0.

## Test plan

- File: `src/lib/items/set-state.test.ts` (extend).
- Cases as listed in step 4; the "settings file untouched after a refused
  archival" case is the one that proves the half-applied bug is fixed.
- Structural pattern: the existing tests in that file, plus
  `src/lib/config/mutate.test.ts` for temporary-home helpers.
- No test may touch the real `~/.claude`: every call passes a `mkdtemp` home
  through `location.homeDir`.
- Verification: `bun test` → all pass.

## Done criteria

ALL must hold:

- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun test` exits 0 with 0 failures
- [ ] `grep -n "snapshotScope" src/lib/items/set-state.ts` returns no matches
- [ ] `grep -rn "expectedSettings\|expectedArchive" src/lib/items/actions.ts` returns both
- [ ] All three list components pass both tokens (`grep -rln "expectedArchive" src/app` lists 3 files)
- [ ] A test asserts the settings file is byte-unchanged after an archival refused for staleness
- [ ] `git status --short` shows only in-scope files
- [ ] `md5 -q ~/.claude/boopervisor.json` unchanged across a full `bun test` run

## STOP conditions

Stop and report back (do not improvise) if:

- The code in "Current state" does not match the live files.
- Adding the fields to `setItemState` turns out to require changing
  `src/components/items/item-state-controls.tsx` or any file outside the scope list.
- You find a fourth caller of `setItemState` beyond `src/lib/items/actions.ts`
  (`grep -rn "setItemState" src`) — the plan assumes one.
- A refusal cannot be produced in a test because `mtimeMs` granularity makes a
  same-millisecond rewrite compare equal. Do not weaken the check to make a test
  pass; report instead. (`src/lib/config/mutate.test.ts` uses `utimes` to move a
  file's mtime deliberately — that is the supported way to force the case.)
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The rule to preserve: **every write compares against what the page read, never
  against a snapshot taken by the writer.** Any new mutation path must take an
  `ExpectedFile` from its caller.
- A reviewer should check that no `expected:` argument anywhere is produced by a
  `captureFileSnapshot` call in the same function that performs the write.
- Because a page now embeds a token per render, an item page left open for a long
  time will refuse a toggle after Claude Code writes to the settings file. That is
  the intended behaviour, and it is what the settings page already does; the
  message tells the user to reload.
- Deliberately deferred: true atomicity across the two files (ADR 0002 rules out
  the design that would give it), and surfacing the refusal any more richly than
  the existing error line.
