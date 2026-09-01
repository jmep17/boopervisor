# Plan 002: Tests never touch the real `~/.claude`, and every file gets its own backup pool

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 69744da..HEAD -- src/lib/config/mutate.ts src/lib/config/mutate.test.ts src/lib/config/mutate-setting.ts src/lib/config/mutate-setting.test.ts src/lib/items/set-state.ts src/lib/items/set-state.test.ts docs/PLAN.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: LOW — two missing arguments and a backup file-name change; restore reads the backup path from the log, so the naming change does not affect it.
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `69744da`, 2026-08-30

## Why this matters

Every `src/lib/config/` function takes a location with an optional `homeDir` so the module
can be tested against a temporary directory (`docs/PLAN.md`: "That module is the actual
product and is unit-tested against a temporary directory"). Two call sites drop that
argument on the way to the write path, so the test suite writes into the **user's real**
`~/.claude`:

- `mutateSetting` passes no `homeDir` to `mutateJsonFile`, so every settings test's backup
  and mutation-log record lands in the real `~/.claude/.boopervisor-backups/` and
  `~/.claude/.boopervisor-mutations.jsonl`.
- `setItemState`'s archival write uses `archivedItemsPath()` with no home, so every archive
  test writes into the real `~/.claude/boopervisor.json`.

On the author's machine at the planned-at commit: 276 of the 294 records in the real
mutation log point at `/var/folders/…/T/boopervisor-*` temp paths; the real
`boopervisor.json` holds 18 `plugin:user:/var/folders/…:a@b` test entries; and all 50 slots
of the `settings.json` backup pool are backups of temp-directory files, because the pool is
keyed by **basename** (`settings.json`) rather than by file. That last point is a bug on its
own even without tests: the user's `~/.claude/settings.json`, every project's
`.claude/settings.json`, and every `.claude/settings.local.json` share one pool of 50, so a
busy project evicts the user's own backups. The History page's "Restore this backup" is only
as good as that pool.

After this plan: passing `homeDir` in a `SettingsLocation` confines _every_ side effect of a
mutation to that home; the backup pool is per file; and a machine-checkable gate proves
`bun test` leaves the real `~/.claude` untouched.

## Current state

Files:

- `src/lib/config/mutate.ts` — `mutateJsonFile`, `writeBackup`, `pruneBackups`, `backupDirectory`.
- `src/lib/config/mutate-setting.ts` — `mutateSetting`, the settings write path.
- `src/lib/items/set-state.ts` — `setItemState` with `writeDisabled` and `writeArchived`.
- `src/lib/items/item-state.ts` — `archivedItemsPath(home)`, `readItemState(home)`, `isArchived(…, home)` already take a home.
- `src/lib/config/mutations.ts` — `appendMutationLog(record, homeDir)`, `mutationLogPath(home)` already take a home.
- Tests: `mutate.test.ts`, `mutate-setting.test.ts`, `set-state.test.ts`.
- `docs/PLAN.md` — documents the backup file name.

`src/lib/config/mutate-setting.ts:46-51` — the dropped argument:

```ts
return mutateJsonFile({
  path: settingFilePath(scope, location),
  expected,
  target: { kind: "setting", scope, project: location.projectRoot, key },
  apply: (content) => applyKey(content, key, value),
});
```

`src/lib/items/set-state.ts:98-108` — the real-home archive write:

```ts
  const path = archivedItemsPath();
  const snapshot = await captureFileSnapshot(path);
  const key = itemKey(type, scope, name, location.projectRoot);
  const existing = asRecord(snapshot.content.archivedItems);
  if (archived === key in existing) return undefined;

  const result = await mutateJsonFile({
    path,
    expected: snapshot,
    target: {
```

`src/lib/items/set-state.test.ts:14-17` — the test file knows:

```ts
/**
 * `setItemState` writes archival to `~/.claude/boopervisor.json` under the real home
 * directory, so these tests only assert on the settings file, which the location controls.
 */
```

`src/lib/config/mutate.ts:455-472` — the basename-keyed pool:

```ts
async function writeBackup(
  path: string,
  text: string,
  homeDir?: string
): Promise<string> {
  const directory = backupDirectory(homeDir);
  await mkdir(directory, { recursive: true });

  const name = basename(path);
  // A second mutation within the same millisecond would otherwise overwrite the first backup.
  let backupPath = join(directory, `${name}.${Date.now()}.json`);
  for (let attempt = 0; await exists(backupPath); attempt += 1) {
    backupPath = join(directory, `${name}.${Date.now() + attempt + 1}.json`);
  }
  await writeFile(backupPath, text, "utf8");
  await pruneBackups(directory, name);
  return backupPath;
}
```

`src/lib/config/mutate.ts:479-480` — the prune pattern:

```ts
async function pruneBackups(directory: string, name: string): Promise<void> {
  const pattern = new RegExp(`^${escapeForRegExp(name)}\\.(\\d+)\\.json$`);
```

`docs/PLAN.md:38-39`:

```
- Every mutation writes a backup first, to `~/.claude/.boopervisor-backups/`, named
  `<file>.<timestamp>.json`, pruned to the most recent 50.
```

Restore (`src/lib/history/actions.ts`) reads `backupPath` from the mutation record and only
checks it lies under `backupDirectory()`; it does not parse the file name. So the naming
change is invisible to restore.

Conventions to match:

- Vocabulary (`CONTEXT.md`): **backup** is "a timestamped copy of a file taken immediately
  before a mutation touches it"; **mutation**; **restore**. Do not say snapshot/revision/rollback.
- Tests build a temp home with `mkdtemp(join(tmpdir(), "boopervisor-…-"))` — see
  `mutate.test.ts:29-36` (`makeHome`) and `mutate-setting.test.ts:10-22` (`makeLocation`).
- Comments explain why, sparingly.

## Commands you will need

| Purpose                 | Command                                                                                                                         | Expected on success     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Typecheck               | `bun run typecheck`                                                                                                             | exit 0                  |
| Lint                    | `bun run lint`                                                                                                                  | exit 0                  |
| One test file           | `bun test src/lib/config/mutate.test.ts`                                                                                        | 0 fail                  |
| All tests               | `bun test`                                                                                                                      | 0 fail                  |
| Real-home gate (before) | `wc -l < ~/.claude/.boopervisor-mutations.jsonl; ls ~/.claude/.boopervisor-backups \| wc -l; shasum ~/.claude/boopervisor.json` | three values; note them |
| Real-home gate (after)  | same three commands after `bun test`                                                                                            | identical values        |

If any of those real-home files does not exist on the executor's machine, the gate is
simply "still does not exist after `bun test`" (`ls ~/.claude/.boopervisor-mutations.jsonl` → no such file).

## Scope

**In scope** (the only files you should modify):

- `src/lib/config/mutate.ts`
- `src/lib/config/mutate.test.ts`
- `src/lib/config/mutate-setting.ts`
- `src/lib/config/mutate-setting.test.ts`
- `src/lib/items/set-state.ts`
- `src/lib/items/set-state.test.ts`
- `docs/PLAN.md` (one line)

**Out of scope** (do NOT touch):

- Anything under the real `~/.claude/`. The residue described above is the user's data to
  clean up, not the executor's. Do not delete, rewrite, or "tidy" it. See Maintenance notes.
- `src/lib/history/actions.ts` — restore is naming-agnostic; leave it.
- `src/lib/config/mcp-mutations.ts` — already threads `homeDir` correctly.
- `src/lib/items/state.ts` / `item-state.ts` — already take a home; the page callers pass none, which is correct for real use.
- `BACKUP_LIMIT` — stays 50.

## Git workflow

- Branch: `advisor/002-test-isolation-and-backup-pools`
- Commit message style: plain imperative sentence (e.g. `Correct what Boopervisor assumed about Claude Code's files`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Record the real-home gate

Run the "Real-home gate (before)" commands and write the three values down. Then run
`bun test` once **before changing anything** and re-run the commands: at the planned-at
commit the mutation-log line count grows and the `boopervisor.json` hash changes. That is the
bug reproduced. Record the new values as the new baseline for the after-check at the end.

**Verify**: values recorded.

### Step 1: Thread `homeDir` through `mutateSetting`

In `src/lib/config/mutate-setting.ts`, add `homeDir: location.homeDir` to the `mutateJsonFile`
call (`mutate.ts`'s `MutationRequest` already has the field).

**Verify**: `bun run typecheck` → 0.

### Step 2: Thread `homeDir` through `setItemState`'s archival write

In `src/lib/items/set-state.ts`, `writeArchived`: use `archivedItemsPath(location.homeDir)`
and pass `homeDir: location.homeDir` to `mutateJsonFile`. (`writeDisabled` already goes
through `mutateSetting`, which Step 1 fixed.)

**Verify**: `grep -n "archivedItemsPath()" src/lib/items/set-state.ts` → no matches.

### Step 3: Give each file its own backup pool

In `src/lib/config/mutate.ts`:

- Add `import { createHash } from "node:crypto";`.
- Add a private helper:

  ```ts
  /**
   * Backups are named for the file and pruned as a set, so the name must tell two files apart
   * that share a basename — the user's settings.json and every project's. The path's digest
   * does that without putting the whole path in a file name.
   */
  function backupStem(path: string): string {
    const digest = createHash("sha1").update(path).digest("hex").slice(0, 8);
    return `${basename(path)}.${digest}`;
  }
  ```

- In `writeBackup`, replace `const name = basename(path);` with `const stem = backupStem(path);`
  and use `stem` in both `join(...)` calls and in `pruneBackups(directory, stem)`.
- `pruneBackups(directory, stem)` — rename the parameter; the regex already escapes it.

Backups written before this change (`settings.json.<timestamp>.json`) match no new stem, so
they are never pruned again and remain restorable through the log. That is intended; say so
in the `writeBackup` doc comment in one sentence.

**Verify**: `bun test src/lib/config/mutate.test.ts` → 0 fail (existing tests should still pass; if one asserts on the exact backup file name, update it to match `<basename>.<8 hex>.<digits>.json` using a regex).

### Step 4: Tests

`src/lib/config/mutate.test.ts` — add:

- "two files that share a basename keep separate backup pools": with one temp home, write
  `BACKUP_LIMIT + 1` mutations to `<home>/a/settings.json` (each with a fresh
  `captureFileSnapshot` as `expected`), then one mutation to `<home>/b/settings.json`. Assert
  the backup directory holds exactly `BACKUP_LIMIT` files whose name starts with
  `settings.json.` + the stem for `a`, and exactly 1 for `b`. Derive the expected stems by
  reading the `backupPath` each `MutationOk` returns (strip the trailing `.<digits>.json`) rather
  than re-implementing the hash in the test.
- "the backup name carries the file's digest, not only its basename": one write, assert
  `result.backupPath` matches `/settings\.json\.[0-9a-f]{8}\.\d+\.json$/`.

`src/lib/config/mutate-setting.test.ts` — add:

- "records the backup and the mutation under the location's home": after a successful
  `mutateSetting`, `await readMutationLog(location.homeDir)` has length 1 with `target.key`
  equal to the key, and `readdir(backupDirectory(location.homeDir))` has length 1.
  (Import `readMutationLog` — already imported — and `backupDirectory` from `./mutate`.)

`src/lib/items/set-state.test.ts` — change:

- Delete the comment at lines 14-17 quoted above.
- In "archiving holds the item disabled as well" (and any other archive/unarchive case), add
  `expect(await isArchived("plugin", "user", "a@b", location.projectRoot, location.homeDir)).toBe(true)`
  (and `false` after enabling). Note the key includes `project` because `writeArchived` passes
  `location.projectRoot`; match that.
- Add "archival is recorded under the location's home": after archiving, the file
  `join(location.homeDir, ".claude", "boopervisor.json")` exists and parses with one
  `archivedItems` entry.

**Verify**: `bun test src/lib/config/mutate.test.ts src/lib/config/mutate-setting.test.ts src/lib/items/set-state.test.ts` → 0 fail.

### Step 5: Update `docs/PLAN.md`

Change the backup line to:

```
- Every mutation writes a backup first, to `~/.claude/.boopervisor-backups/`, named
  `<file>.<path digest>.<timestamp>.json` and pruned to the most recent 50 per file.
```

**Verify**: `grep -n "path digest" docs/PLAN.md` → one match.

### Step 6: Full gates and the real-home gate

Run `bun run typecheck`, `bun run lint`, `bun test`. Then run the "Real-home gate (after)"
commands and compare with the baseline from Step 0: all three values identical.

**Verify**: identical values; `bun test` → 0 fail.

## Test plan

Covered in Step 4. Patterns: `mutate.test.ts` (`makeHome`, `write` helper) and
`mutate-setting.test.ts` (`makeLocation`). Verification: `bun test` → 0 fail with 4 new tests
present (grep the test names).

## Done criteria

- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun test` exits 0
- [ ] `grep -n "homeDir: location.homeDir" src/lib/config/mutate-setting.ts src/lib/items/set-state.ts` → one match in each file
- [ ] `grep -n "archivedItemsPath()" src/lib/items/set-state.ts` → no matches
- [ ] `grep -n "backupStem" src/lib/config/mutate.ts` → at least 2 matches
- [ ] Real-home gate: line count of `~/.claude/.boopervisor-mutations.jsonl`, file count in `~/.claude/.boopervisor-backups`, and `shasum ~/.claude/boopervisor.json` are identical before and after `bun test`
- [ ] `git status --porcelain` lists only in-scope files (and `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The excerpts in "Current state" do not match the live code.
- `MutationRequest` in `mutate.ts` no longer has a `homeDir` field.
- After Steps 1–2, `bun test` still changes any of the three real-home gate values: some
  other call site writes to the real home. Report the mutation-log `path`/`target` of the new
  records (`tail -3 ~/.claude/.boopervisor-mutations.jsonl | jq '{path, target}'`) rather than hunting further.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **Residue on the author's machine** (the user's call, not the executor's — listed so it can
  be cleaned deliberately): entries whose key starts with `plugin:user:/var/folders/` in
  `~/.claude/boopervisor.json` (18 at planning time); records whose `path` starts with
  `/var/folders/` or `/tmp/` in `~/.claude/.boopervisor-mutations.jsonl` (276); and their
  backups in `~/.claude/.boopervisor-backups/`. Read-only count:
  `jq -r 'select(.path|startswith("/var/folders/")) | .path' ~/.claude/.boopervisor-mutations.jsonl | wc -l`.
  Note that the user's genuine `settings.json` backups from before the tests ran may already
  have been evicted; nothing here can bring those back.
- Any new function that writes must accept and forward `homeDir` from its `SettingsLocation`.
  Reviewer: for every `mutateJsonFile(` call, check `homeDir` is passed.
- If `BACKUP_LIMIT` is ever made configurable, prune per stem, never per directory.
