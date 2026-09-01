# Plan 013: A restore writes only the file the log recorded, and refuses a backup it cannot parse

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9372dd4..HEAD -- src/lib/history/actions.ts src/lib/config/json-file.ts src/components/history/history-row.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P0
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security, bug
- **Planned at**: commit `9372dd4`, 2026-09-01

## Why this matters

Two defects in one Server Action, `restoreFromBackup`.

1. **The browser decides which file gets overwritten.** The action reads
   `targetPath` straight out of the submitted form and writes to it. The backup
   path next to it _is_ checked (it must resolve under the backups directory),
   which shows the check was thought about for one input and missed for the
   other. Boopervisor's own code states the opposite invariant in two places:
   `src/lib/config/settings.ts:18-22` — "Reading and writing both resolve paths
   through this, so a mutation can never target a file the page did not read" —
   and `src/lib/config/actions.ts:16-20` — "everything else — which file that
   is, whether the value is allowed, the backup — belongs to the server". The
   server already knows the right answer: every mutation record in the log
   carries both `backupPath` and the `path` it was taken from. Looking the
   target up instead of accepting it costs nothing and restores the invariant.

2. **A backup that is not a JSON object restores as `{}`.** The action parses
   the backup with `parseJsonObject`, which returns an empty object for
   `invalid-json` and for empty text, and then writes that empty object over
   the user's live file — reporting success. A truncated or hand-mangled backup
   therefore wipes the file it was supposed to rescue. This is the exact
   failure `mutateJsonFile` already refuses on the _destination_ side
   (`src/lib/config/mutate.ts:103-109`: "Boopervisor will not overwrite a file
   it cannot read"); the source side needs the same refusal.

After this plan: a restore can only ever write the file its own log entry
names, and a backup that cannot be parsed is refused with a message instead of
silently emptying a config file.

## Current state

Files:

- `src/lib/history/actions.ts` — the `restoreFromBackup` Server Action; the whole file is 67 lines and both defects are in it.
- `src/lib/config/mutations.ts` — `readMutationLog()` returns `MutationRecord[]`, newest first; each record has `timestamp`, `target`, `path`, `backupPath`, `before`, `after`.
- `src/lib/config/json-file.ts` — `parseJsonObject(text)` returns `{ content, state }` where `state` is `"ok" | "missing" | "empty" | "invalid-json"`.
- `src/components/history/history-row.tsx` — the only caller; renders the hidden form fields.

`src/lib/history/actions.ts:21-67` as it stands:

```ts
export async function restoreFromBackup(
  _previous: RestoreState,
  formData: FormData
): Promise<RestoreState> {
  const backupPath = String(formData.get("backupPath") ?? "").trim();
  if (!backupPath) return { error: "No backup specified." };

  const backupDir = backupDirectory();

  // Verify the backup path is under the backups directory to prevent directory traversal
  const resolvedBackupPath = resolve(backupPath);
  const resolvedBackupDir = resolve(backupDir);
  if (!resolvedBackupPath.startsWith(resolvedBackupDir + "/")) {
    return { error: "Invalid backup path." };
  }

  // Read the backup file
  let backupText: string;
  try {
    backupText = await readFile(resolvedBackupPath, "utf8");
  } catch {
    return { error: "Backup file not found or could not be read." };
  }

  // Extract the original file path from the form
  const targetPath = String(formData.get("targetPath") ?? "").trim();
  if (!targetPath) return { error: "No target file specified." };

  // Decode the expected state from the form
  const expected = decodeExpectedFile(String(formData.get("expected") ?? ""));

  // Parse the backup contents
  const { content: backupContent } = parseJsonObject(backupText);

  // Apply the restore as a mutation
  const result = await mutateJsonFile({
    path: targetPath,
    expected,
    target: { kind: "restore", backupPath: resolvedBackupPath },
    apply: () => backupContent,
  });

  if (!result.ok) return { error: result.message };

  revalidatePath("/history");
  return { ok: true };
}
```

`src/lib/config/json-file.ts:35-50` — why an unparseable backup becomes `{}`:

```ts
export function parseJsonObject(text: string): {
  content: JsonObject;
  state: FileState;
} {
  if (!text.trim()) return { content: {}, state: "empty" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { content: {}, state: "invalid-json" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { content: {}, state: "invalid-json" };
  }
  return { content: parsed as JsonObject, state: "ok" };
}
```

`src/components/history/history-row.tsx:124-127` — the form that submits it:

```tsx
          <form action={submit} className="flex flex-col gap-4">
            <input type="hidden" name="backupPath" value={record.backupPath} />
            <input type="hidden" name="targetPath" value={record.path} />
            <input type="hidden" name="expected" value={expectedFile} />
```

Note: an **empty** backup (`state: "empty"`) is legitimate and must keep
working. `src/lib/config/mutate.ts:143-149` records why: "An absent file is
backed up as empty, so a restore can return it to not existing in substance if
not in name." Only `invalid-json` is refused.

### Conventions to match

- **Result objects, never thrown errors, for expected failures.** Every module
  here returns a typed result. See `src/lib/config/mutate.ts:21-34`:

  ```ts
  export type MutationResult = MutationOk | MutationError;

  export interface MutationError {
    ok: false;
    /** `stale`: the file changed since it was read. `invalid`: validation refused the value. */
    problem: "stale" | "invalid" | "io-error";
    message: string;
  }
  ```

  `RestoreState` (`src/lib/history/actions.ts:11-14`) is the action-level
  equivalent — `{ ok?: boolean; error?: string }`. Keep using it.

- **Comments say why, not what.** The existing comments in this file
  (`// Read the backup file`, `// Parse the backup contents`) restate the code
  and are below the repo's bar — see `src/lib/config/mutate.ts:143-149` or
  `src/lib/items/item-state.ts:61-66` for the house style. Replace them as you
  rewrite; do not add more of the same.

- **Vocabulary** (from `CONTEXT.md`, quoted — the executor has not read it):
  - "**Backup**: A timestamped copy of a file taken immediately before a mutation touches it. _Avoid_: Snapshot, revision, checkpoint"
  - "**Restore**: Returning a file to the contents of one of its backups. Itself a mutation, and so itself backed up. _Avoid_: Revert, rollback, undo"
  - "**Mutation**: A single user-initiated change that Boopervisor writes to disk."

  Use these words in names, messages and comments.

- **Tests use a real temporary directory, never mocks, and never the real home.**
  See `src/lib/config/mutate.test.ts:27-37`:

  ```ts
  async function makeHome(
    contents?: string
  ): Promise<{ homeDir: string; path: string }> {
    const homeDir = await mkdtemp(join(tmpdir(), "boopervisor-mutate-"));
    const path = join(homeDir, ".claude", "settings.json");
    if (contents !== undefined) {
      await mkdir(join(homeDir, ".claude"), { recursive: true });
      await writeFile(path, contents);
    }
    return { homeDir, path };
  }
  ```

  This matters: plan 002 exists because tests once wrote into the real
  `~/.claude`. Never call a function that defaults to `homedir()` without
  passing a temporary directory.

## Commands you will need

| Purpose   | Command                                    | Expected on success |
| --------- | ------------------------------------------ | ------------------- |
| Install   | `bun install`                              | exit 0              |
| Typecheck | `bun run typecheck`                        | exit 0, no output   |
| Lint      | `bun run lint`                             | exit 0              |
| Tests     | `bun test`                                 | all pass, 0 fail    |
| One file  | `bun test src/lib/history/restore.test.ts` | all pass, 0 fail    |

A fresh worktree has no `node_modules`: run `bun install` first.

## Scope

**In scope** (the only files you should modify or create):

- `src/lib/history/restore.ts` (create)
- `src/lib/history/restore.test.ts` (create)
- `src/lib/history/actions.ts` (rewrite the body of `restoreFromBackup`)

**Out of scope** (do NOT touch, even though they look related):

- `src/components/history/history-row.tsx` — the `targetPath` hidden input
  becomes unused, but leaving it costs nothing and removing it drags a client
  component and its tests into a server-side fix. A later plan can drop it.
- `src/lib/config/json-file.ts` — `parseJsonObject` is correct; the caller is
  what ignores `state`.
- `src/lib/config/mutate.ts` — the mutation path is fine.
- The backups-directory traversal check. It stays exactly as it is: it is a
  second, independent guard, and step 1 does not replace it.

## Git workflow

- Branch: `advisor/013-restore-targets-the-recorded-file`
- Commit per step. Message style, from `git log`: a single imperative sentence,
  no type prefix, e.g. `Replace Bun.file().exists() with node:fs/promises access so saves work under Node`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a testable module that resolves a restore

Create `src/lib/history/restore.ts`. It holds the whole decision — which file a
backup may be written to, and whether the backup is usable — as pure-ish
functions that take a home directory, so they can be tested without Next.

```ts
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { backupDirectory } from "@/lib/config/mutate";
import { parseJsonObject, type JsonObject } from "@/lib/config/json-file";
import { readMutationLog } from "@/lib/config/mutations";

export type ResolvedRestore =
  | { ok: true; backupPath: string; targetPath: string; content: JsonObject }
  | { ok: false; error: string };

/**
 * What a restore is allowed to do, decided entirely from the backup path.
 *
 * The file a backup may be written to is the one the mutation log recorded it
 * against, never one the form names: the browser says which backup to restore,
 * and nothing else. A backup that will not parse as a JSON object is refused
 * rather than written as `{}`, which would empty the very file it should rescue.
 */
export async function resolveRestore(
  backupPath: string,
  homeDir?: string
): Promise<ResolvedRestore> {
  // ...
}
```

Behaviour, in this order:

1. Trim `backupPath`; empty → `{ ok: false, error: "No backup specified." }`.
2. `resolve()` it and require it to sit under `resolve(backupDirectory(homeDir)) + "/"`;
   otherwise `{ ok: false, error: "Invalid backup path." }`. (Same check as
   today, now taking `homeDir` so it is testable.)
3. Read the mutation log with `readMutationLog(homeDir)` and find the newest
   record whose `backupPath` resolves to the same path. None →
   `{ ok: false, error: "That backup is not in the mutation log, so Boopervisor does not know which file it belongs to." }`.
   (`readMutationLog` returns newest first, so `find` gives the newest.)
4. Read the backup file; failure →
   `{ ok: false, error: "Backup file not found or could not be read." }`.
5. `parseJsonObject` the text. `state === "invalid-json"` →
   `{ ok: false, error: "That backup is not valid JSON. Boopervisor will not restore a file it cannot read." }`.
   `"empty"` and `"ok"` both proceed — an empty backup is how an absent file
   was recorded.
6. Otherwise `{ ok: true, backupPath: <resolved>, targetPath: <record.path>, content }`.

Use `@/lib/...` import paths — every module in `src/lib` does.

**Verify**: `bun run typecheck` → exit 0, no output.

### Step 2: Test it

Create `src/lib/history/restore.test.ts`, modelled structurally on
`src/lib/config/mutate.test.ts` (real `mkdtemp` home, no mocks). Write a helper
that builds a temporary home containing a backup file under
`<home>/.claude/.boopervisor-backups/` and a matching line in
`<home>/.claude/.boopervisor-mutations.jsonl`; `appendMutationLog(record, homeDir)`
from `@/lib/config/mutations` is the supported way to write that line.

Cases (all calling `resolveRestore(path, homeDir)` with the temporary home):

- resolves the target path from the log rather than anything the caller supplies
- refuses a backup path outside the backups directory (use `../../etc/hosts` style input, and an absolute `/etc/hosts`)
- refuses a backup path that is in the backups directory but has no log record
- refuses a backup whose text is truncated JSON (e.g. `{"model": "opus"`), and the error names it as not valid JSON
- accepts an empty backup and returns `{}` as its content, since that is how an absent file was backed up
- accepts a well-formed backup and returns its parsed content and the recorded target path
- when two records share a backup path, returns the newest one's target

**Verify**: `bun test src/lib/history/restore.test.ts` → all pass, 0 fail, at
least 7 tests.

### Step 3: Make the action a thin wrapper

Rewrite `restoreFromBackup` in `src/lib/history/actions.ts` so it reads the
backup path and the expected-file token from the form, calls `resolveRestore`,
and passes `resolution.targetPath` to `mutateJsonFile`. `targetPath` must no
longer be read from `formData` anywhere in the file. Keep `revalidatePath("/history")`
and the `RestoreState` shape. Drop the now-unused imports (`readFile`,
`resolve`, `backupDirectory`, `parseJsonObject`) — lint will flag any you miss.

The `apply` callback stays `() => resolution.content`, and the mutation target
stays `{ kind: "restore", backupPath: resolution.backupPath }`.

**Verify**:

- `grep -n "targetPath" src/lib/history/actions.ts` → no matches.
- `bun run lint` → exit 0.
- `bun run typecheck` → exit 0.

### Step 4: Full gates

**Verify**: `bun test` → 0 fail (350 tests passed at `9372dd4`, plus your new
ones); `bun run typecheck` → exit 0; `bun run lint` → exit 0.

## Test plan

- New file `src/lib/history/restore.test.ts`, cases as listed in step 2 — the
  traversal refusal, the missing-log-record refusal, the truncated-backup
  refusal (this is the data-loss regression), the empty-backup acceptance, and
  the happy path.
- Structural pattern: `src/lib/config/mutate.test.ts` — `describe` per function,
  `test("a sentence describing the behaviour", ...)`, real temporary directories.
- No test may touch `~/.claude`. Every call passes a `mkdtemp` home.
- Verification: `bun test` → all pass.

## Done criteria

ALL must hold:

- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun test` exits 0 with 0 failures
- [ ] `src/lib/history/restore.test.ts` exists and holds at least 7 tests, all passing
- [ ] `grep -n 'formData.get("targetPath")' src/lib/history/actions.ts` returns no
      matches. (Note: a bare `grep -n "targetPath"` still matches
      `path: resolution.targetPath` — that is the `ResolvedRestore` field this plan
      specifies, not the form input, and it is correct.)
- [ ] `grep -rn "formData.get(\"targetPath\")" src/lib` returns no matches
- [ ] A test proves a truncated backup is refused rather than written as `{}`
- [ ] `git status --short` shows only the three in-scope files
- [ ] `md5 -q ~/.claude/boopervisor.json` is unchanged across a full `bun test` run (tests must not touch the real home)

## STOP conditions

Stop and report back (do not improvise) if:

- The code in "Current state" does not match the live files.
- `readMutationLog` turns out not to record `backupPath` for some mutation kind
  you can construct — that would mean some backups are unrestorable under the
  new rule, and the plan needs rethinking rather than a workaround.
- Making the log lookup work seems to require changing `src/lib/config/mutations.ts`
  or `src/lib/config/mutate.ts`.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The rule to preserve: **the form names a backup, the server decides the
  target**. Any future restore feature (restore-all, restore-to-a-copy) must
  keep deriving the destination from the log.
- A reviewer should check that the traversal guard was kept _as well as_ the
  log lookup, not replaced by it — the log is data Boopervisor wrote, and a
  second independent check on the path costs one line.
- Deliberately deferred: removing the dead `targetPath` hidden input from
  `src/components/history/history-row.tsx`, and pruning the mutation log
  (see plan 017).
