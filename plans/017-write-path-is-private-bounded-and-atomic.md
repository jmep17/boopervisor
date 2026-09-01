# Plan 017: Backups and the mutation log are private and bounded, and a write never truncates a config file

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9372dd4..HEAD -- src/lib/config/mutate.ts src/lib/config/mutations.ts src/lib/config/mutate.test.ts src/lib/config/mutations.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — every write in the application goes through the code this plan changes.
- **Depends on**: none. (If plan 013 is in flight, land it first: it adds a test file next to these, though it does not edit `mutate.ts`.)
- **Category**: security, bug
- **Planned at**: commit `9372dd4`, 2026-09-01

## Why this matters

Three defects in the shared write path, batched because they are all in two
files and each is a small, independently verifiable change.

1. **Backups and the mutation log are world-readable.** Every mutation writes a
   verbatim copy of the file to `~/.claude/.boopervisor-backups/` and appends the
   file's full text, before and after, to `~/.claude/.boopervisor-mutations.jsonl`.
   Both are created with the process umask — observed on the author's machine as
   `-rw-r--r--` files in a `drwxr-xr-x` directory. Claude Code settings files can
   carry an `env` block, and `~/.claude.json` carries each MCP server's `env`;
   those hold API keys. Boopervisor therefore takes credentials that live in one
   file and copies them into dozens more, each readable by every other account on
   the machine. `0600` files in a `0700` directory cost two constants.

2. **The mutation log grows without bound.** `appendMutationLog` only ever
   appends and nothing prunes it. On the author's machine it is already 390
   records and 452 KB, and every `/history` render reads and parses all of it.
   Backups are capped per file at `BACKUP_LIMIT = 50` (`mutate.ts:37`); the log
   that indexes them has no cap at all.

3. **A write can truncate a live config file.** `mutateJsonFile` calls
   `writeFile(path, text, "utf8")` directly. If the process dies or the disk
   fills mid-write, the user's `settings.json` is left half-written. The backup
   taken moments earlier makes it recoverable _by a human who notices_, but
   Claude Code may read the truncated file first — and a config editor whose
   whole purpose is safe writes should not have a window in which it corrupts
   the file it is editing. Writing a temporary file in the same directory and
   renaming it over the target closes the window: `rename` within a filesystem
   is atomic.

After this plan: no file Boopervisor creates is readable by other users, the log
stays bounded, and the target file is either its old contents or its new
contents, never something in between.

## Current state

Files:

- `src/lib/config/mutate.ts` (212 lines) — `mutateJsonFile`, `writeBackup`, `pruneBackups`.
- `src/lib/config/mutations.ts` (67 lines) — `appendMutationLog`, `readMutationLog`, `mutationLogPath`.
- `src/lib/config/mutate.test.ts`, `src/lib/config/mutations.test.ts` — their tests.

`src/lib/config/mutate.ts:117-141`, the write:

```ts
const text = serializeLike(next, current.text);

try {
  const backupPath = await writeBackup(path, current.text, homeDir);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, "utf8");

  const record: MutationRecord = {
    timestamp: new Date().toISOString(),
    target,
    path,
    backupPath,
    before: current.text,
    after: text,
  };
  await appendMutationLog(record, homeDir);
  return { ok: true, backupPath, record };
} catch (error) {
  return {
    ok: false,
    problem: "io-error",
    message: (error as Error).message,
  };
}
```

`src/lib/config/mutate.ts:151-168`, the backup:

```ts
async function writeBackup(
  path: string,
  text: string,
  homeDir?: string
): Promise<string> {
  const directory = backupDirectory(homeDir);
  await mkdir(directory, { recursive: true });

  const stem = backupStem(path);
  // A second mutation within the same millisecond would otherwise overwrite the first backup.
  let backupPath = join(directory, `${stem}.${Date.now()}.json`);
  for (let attempt = 0; await exists(backupPath); attempt += 1) {
    backupPath = join(directory, `${stem}.${Date.now() + attempt + 1}.json`);
  }
  await writeFile(backupPath, text, "utf8");
  await pruneBackups(directory, stem);
  return backupPath;
}
```

`src/lib/config/mutations.ts:33-56`, the log:

```ts
/** Append-only JSONL, so a mutation is never lost to a rewrite of the whole log. */
export function mutationLogPath(home: string = homedir()): string {
  return join(home, ".claude", ".boopervisor-mutations.jsonl");
}

export async function appendMutationLog(
  record: MutationRecord,
  homeDir?: string
): Promise<void> {
  const path = mutationLogPath(homeDir);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, "utf8");
}

/** Newest first, which is the order `/history` lists them in. A malformed line is skipped, not fatal. */
export async function readMutationLog(
  homeDir?: string
): Promise<MutationRecord[]> {
  let text: string;
  try {
    text = await readFile(mutationLogPath(homeDir), "utf8");
  } catch {
    return [];
  }
```

Observed on disk at `9372dd4`:

```
$ ls -l ~/.claude/.boopervisor-mutations.jsonl
-rw-r--r--@ 1 <user> staff 462615 ...
$ ls -ld ~/.claude/.boopervisor-backups
drwxr-xr-x@ 86 <user> staff 2752 ...
```

### Design decisions already made — implement these, do not redesign

- **Rotation, not rewriting.** The comment at `mutations.ts:33` — "Append-only
  JSONL, so a mutation is never lost to a rewrite of the whole log" — is a
  deliberate property. Keep it: when the log exceeds a size limit, **rename** it
  to `.boopervisor-mutations.1.jsonl` (replacing any previous rotation) and
  start a new one. Never rewrite a log in place, and never drop lines from the
  middle of a file.
- **`/history` reads the current log only.** `readMutationLog` keeps reading one
  file. Older records stay on disk in the rotated file, restorable by hand, but
  fall off the page. That is the accepted trade-off; say so in the doc comment.
- **The temporary file for an atomic write lives in the target's own
  directory**, named from the target's basename (e.g. `.settings.json.<pid>.tmp`),
  because `rename` is only atomic within one filesystem. Clean it up when the
  write fails.

### Conventions to match

- **Result objects, never thrown errors, for expected failures**
  (`src/lib/config/mutate.ts:21-34`). An IO failure here is already mapped to
  `{ ok: false, problem: "io-error" }` — keep it that way.
- **A failure to prune never fails a write** — the existing `pruneBackups`
  swallows its errors deliberately (`mutate.ts:190,205-207`). Rotation must do
  the same.
- **Comments say why, not what** — `src/lib/config/mutate.ts:143-149` is the house style.
- **Tests use real temporary directories via `mkdtemp`, never mocks, never the
  real home** — `src/lib/config/mutate.test.ts:27-37`.
- **Vocabulary** (`CONTEXT.md`): "**Backup**: A timestamped copy of a file taken
  immediately before a mutation touches it." — keep calling them backups.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
| --------- | ---------------------------------------- | ------------------- |
| Install   | `bun install`                            | exit 0              |
| Typecheck | `bun run typecheck`                      | exit 0, no output   |
| Lint      | `bun run lint`                           | exit 0              |
| Tests     | `bun test`                               | all pass, 0 fail    |
| One file  | `bun test src/lib/config/mutate.test.ts` | all pass, 0 fail    |

A fresh worktree has no `node_modules`: run `bun install` first.

## Scope

**In scope**:

- `src/lib/config/mutate.ts`
- `src/lib/config/mutations.ts`
- `src/lib/config/mutate.test.ts`
- `src/lib/config/mutations.test.ts`

**Out of scope** (do NOT touch):

- Existing files on the user's machine. This plan changes the mode of files
  Boopervisor creates from now on; it does not chmod what is already there, and
  it must not try to.
- `src/components/history/**` and `src/app/**` — how `/history` renders is a
  separate concern (recorded as an unplanned finding in `plans/README.md`).
- `BACKUP_LIMIT` and the per-file backup pruning — they work.
- Redacting or encrypting secrets in backups. Worth doing, out of scope here;
  file permissions are the cheap 80%.

## Git workflow

- Branch: `advisor/017-write-path-is-private-bounded-and-atomic`
- One commit per step (three). Message style, from `git log`: one imperative
  sentence, no type prefix.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create everything private

In `src/lib/config/mutate.ts`, add and use two constants:

```ts
/** Backups and the mutation log hold verbatim copies of files that may carry API keys. */
const PRIVATE_FILE = 0o600;
const PRIVATE_DIRECTORY = 0o700;
```

Apply them to:

- the backups directory: `mkdir(directory, { recursive: true, mode: PRIVATE_DIRECTORY })`
- the backup file: `writeFile(backupPath, text, { encoding: "utf8", mode: PRIVATE_FILE })`

Do the same in `src/lib/config/mutations.ts` for the log's `mkdir` and its
`appendFile`. Export the two constants from `mutate.ts` and import them in
`mutations.ts` rather than duplicating the literals.

Do **not** change the mode of the target config file itself — that file belongs
to Claude Code and Boopervisor must not alter its permissions.

Note for your own expectations: `mode` is masked by the process umask, and it
only applies when the file is _created_. An existing log keeps its old mode;
that is expected and is why the done criteria test a fresh temporary home.

**Verify**: a new test in `src/lib/config/mutate.test.ts` that mutates a file in
a fresh `mkdtemp` home and then asserts, with `stat`:

```ts
expect(stats.mode & 0o777).toBe(0o600); // the backup file
expect(dirStats.mode & 0o777).toBe(0o700); // the backups directory
```

plus the equivalent for the log in `src/lib/config/mutations.test.ts`.
`bun test src/lib/config/mutate.test.ts src/lib/config/mutations.test.ts` → all pass.

### Step 2: Bound the log by rotation

In `src/lib/config/mutations.ts`:

```ts
/** The log is rotated, not rewritten, once it passes this. One previous file is kept. */
export const MUTATION_LOG_LIMIT_BYTES = 5_000_000;

export function rotatedMutationLogPath(home: string = homedir()): string {
  return join(home, ".claude", ".boopervisor-mutations.1.jsonl");
}
```

`appendMutationLog` stats the log before appending; when its size is at or above
the limit, it renames it to the rotated path (replacing any existing rotated
file — `rename` does that) and then appends to a fresh file. Wrap the rotation in
try/catch and swallow failures: a log that cannot be rotated is still a log, and
must never fail a write. Update the doc comment on `mutationLogPath` to record
that `/history` reads the current file only.

**Verify**: new tests in `src/lib/config/mutations.test.ts` against a temporary home:

- a log below the limit is appended to and not rotated
- a log at or above the limit is rotated: the rotated path exists with the old
  content, and the current log holds only the new record
- `readMutationLog` after a rotation returns only the current file's records
- rotation happening twice leaves exactly one rotated file

`bun test src/lib/config/mutations.test.ts` → all pass.

### Step 3: Write atomically

In `src/lib/config/mutate.ts`, replace the direct
`await writeFile(path, text, "utf8")` with a helper in the same file:

```ts
/**
 * The target is either its old contents or its new ones, never half of each: the text goes
 * to a temporary file beside it and is renamed over it, and rename within a directory is
 * atomic. The backup taken a moment earlier covers the case where even this fails.
 */
async function writeFileAtomically(path: string, text: string): Promise<void>;
```

It writes `join(dirname(path), `.${basename(path)}.${process.pid}.tmp`)`, then
`rename`s it onto `path`. On failure, remove the temporary file
(`rm(tmp, { force: true })`) and rethrow so the existing `catch` maps it to
`{ ok: false, problem: "io-error" }`. Keep the
`mkdir(dirname(path), { recursive: true })` call before it — the directory must
exist for both the temporary file and the target.

Do not give the temporary file a private mode: the target's own permissions are
Claude Code's business, and `rename` carries the temporary file's mode onto the
target. Create it with the default mode so an existing file's effective
permissions do not change under the user.

**Verify**: new tests in `src/lib/config/mutate.test.ts`:

- after a successful mutation, no `.tmp` file is left in the target's directory
  (`readdir` and assert nothing matches `/\.tmp$/`)
- the file's contents are exactly what the previous test suite expected — the
  existing tests cover this and must all still pass
- a mutation into a directory that cannot be created returns
  `{ ok: false, problem: "io-error" }` rather than throwing

`bun test src/lib/config/mutate.test.ts` → all pass.

### Step 4: Full gates

**Verify**: `bun test` → 0 fail (350 passed at `9372dd4`, plus your new ones);
`bun run typecheck` → exit 0; `bun run lint` → exit 0.

## Test plan

- New tests in `src/lib/config/mutate.test.ts` (modes, no leftover temporary
  file, io-error path) and `src/lib/config/mutations.test.ts` (log mode,
  rotation, reading after rotation).
- Structural pattern: the existing `describe`/`test` blocks in those two files.
- Every test uses a `mkdtemp` home and passes it as `homeDir`. Nothing may touch
  the real `~/.claude` — verify with the md5 check in the done criteria.
- Verification: `bun test` → all pass.

## Done criteria

ALL must hold:

- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun test` exits 0 with 0 failures
- [ ] A test asserts a newly created backup file is mode `0600` and the backups directory `0700`
- [ ] A test asserts a newly created mutation log is mode `0600`
- [ ] A test asserts the log rotates at the limit and that the previous content survives in the rotated file
- [ ] A test asserts no `.tmp` file remains after a successful mutation
- [ ] `grep -n "writeFile(path, text" src/lib/config/mutate.ts` returns no matches
- [ ] `git status --short` shows only the four in-scope files
- [ ] `md5 -q ~/.claude/boopervisor.json` unchanged across a full `bun test` run

## STOP conditions

Stop and report back (do not improvise) if:

- The code in "Current state" does not match the live files.
- A mode assertion fails because the environment's umask masks the bits you set
  — report the observed mode; do not `chmod` after the fact to force a test green
  (a `chmod` after creation reopens the window this step exists to close).
- Making the write atomic appears to require changing `serializeLike`,
  `captureFileSnapshot`, or anything in `src/lib/config/json-file.ts`.
- Rotation appears to require rewriting or truncating a log file in place. It
  does not: it is a `rename`.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The rules to preserve: **anything Boopervisor creates under `~/.claude` that
  holds a copy of a config file is `0600`**, and **the target file is written by
  rename, never in place**.
- A reviewer should check the temporary file is created in the target's own
  directory. A temporary file in `/tmp` renamed across filesystems is not atomic
  and will fail with `EXDEV` on some machines.
- `readMutationLog` deliberately reads only the current log. If `/history` ever
  needs the full record, it should read both files rather than the rotation
  being removed.
- Deliberately deferred: redacting secrets from backups and the log, tightening
  the permissions of files that already exist, and paginating `/history` (all
  recorded as unplanned findings in `plans/README.md`).
