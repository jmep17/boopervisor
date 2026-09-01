# Plan 016: Every Server Action's input handling is a tested function

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9372dd4..HEAD -- src/lib/config/actions.ts src/lib/items/actions.ts src/lib/scope/actions.ts src/lib/history/actions.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `plans/013-restore-targets-the-recorded-file.md` and `plans/014-item-writes-are-stale-checked.md` — both edit these same action files. Land them first.
- **Category**: tests
- **Planned at**: commit `9372dd4`, 2026-09-01

## Why this matters

Boopervisor has 350 tests and a strong testing culture: the file-format modules,
the mutation path, the catalog and the components are all covered against real
temporary directories. Four files have none — and they are the four where every
piece of user input arrives:

- `src/lib/config/actions.ts` — `writeSetting`
- `src/lib/items/actions.ts` — `changeItemState`
- `src/lib/scope/actions.ts` — `selectScope`, `addProjectScope`
- `src/lib/history/actions.ts` — `restoreFromBackup`

Each of them turns a `FormData` into a decision: which scope may be written,
whether a string is one of three legal item states, whether a path is usable.
Those decisions are the application's trust boundary, and every one of them is
currently unverified. Two of the defects this backlog is fixing (plans 013 and 014) live in exactly this untested layer, which is not a coincidence.

They are untested for a real reason: a `"use server"` function that calls
`cookies()` from `next/headers` and `revalidatePath()` from `next/cache` cannot
run under `bun test` without a Next request context. The fix is not to mock
Next. It is to move each action's _decision_ into a plain function that takes
its inputs as arguments, leaving the action itself a wrapper thin enough that
reading it is enough to trust it.

After this plan: every branch that rejects or reshapes user input is a tested
function, and each `"use server"` function is a handful of lines that read
cookies, call the tested function, and revalidate.

## Current state

None of these four files has a matching `.test.ts`. Confirm with:

```
for f in src/lib/config/actions.ts src/lib/items/actions.ts src/lib/scope/actions.ts src/lib/history/actions.ts; do
  test -f "${f%.ts}.test.ts" && echo "HAS TEST: $f" || echo "no test: $f"
done
```

The decisions to extract, quoted from the live code:

`src/lib/config/actions.ts:21-54` — `writeSetting`. The untested logic is the
scope check and the value parse:

```ts
const key = String(formData.get("key") ?? "").trim();
if (!key) return { error: "No setting named." };

const selected = await getSelectedScope();
const scope = String(formData.get("scope") ?? "") as Scope;
if (scope !== "user" && scope !== "project" && scope !== "local") {
  return { error: "That scope cannot be written." };
}
if (scope !== "user" && selected.kind !== "project") {
  return { error: "Select a project before editing its settings." };
}
const location = {
  projectRoot: selected.kind === "project" ? selected.path : undefined,
};

const raw = formData.get("value");
const parsed = parseValueForSetting(
  raw === null ? undefined : String(raw),
  getSetting(key),
  formData.get("unset") !== null
);
if (!parsed.ok) return { error: parsed.problem };
```

`src/lib/items/actions.ts:29-51` — `changeItemState`. The untested logic is the
three-way field validation:

```ts
const type = String(formData.get("type") ?? "") as ItemType;
const name = String(formData.get("name") ?? "");
const state = String(formData.get("state") ?? "") as ItemState;
const sourceField = formData.get("source");
const source =
  sourceField === "user" || sourceField === "project" || sourceField === "local"
    ? (sourceField as McpSource)
    : undefined;

if (!(type in PAGES))
  return { error: "That is not a kind of item Boopervisor manages." };
if (!name) return { error: "No item named." };
if (state !== "enabled" && state !== "disabled" && state !== "archived") {
  return { error: "That is not a state an item can be in." };
}
```

`src/lib/scope/actions.ts:42-60` — `addProjectScope`. The untested logic is the
path check and the manual-projects list update:

```ts
const path = String(formData.get("path") ?? "").trim();
if (!path) return { error: "Enter a directory path." };

const check = await checkProjectDirectory(path);
if (check !== "ok") return { error: MESSAGES[check] };

const store = await cookies();
const manual = parseManualProjects(store.get(MANUAL_PROJECTS_COOKIE)?.value);
if (!manual.includes(path)) {
  store.set(
    MANUAL_PROJECTS_COOKIE,
    serializeManualProjects([...manual, path]),
    SCOPE_COOKIE_OPTIONS
  );
}
```

`src/lib/history/actions.ts` — after plan 013 lands, its decision already lives
in a tested `src/lib/history/restore.ts`. **This plan does not touch it**; it
is the model the other three follow.

### The pattern to follow

Plan 013 creates `src/lib/history/restore.ts` holding `resolveRestore()`, tested
in `src/lib/history/restore.test.ts`, with the action reduced to: read the form,
call it, `revalidatePath`, return. Read both files before starting — they are
the worked example of what the other three should look like.

### Conventions to match

- **Result objects, never thrown errors, for expected failures**
  (`src/lib/config/mutate.ts:21-34`). Each extracted function returns a
  discriminated result; the action maps it to its own `{ error }` shape.
- **Comments say why, not what** — see `src/lib/items/item-state.ts:61-66`.
- **Tests use real temporary directories via `mkdtemp`, never mocks, never the
  real home.** `src/lib/config/mutate.test.ts:27-37` is the pattern. Plan 002
  exists because tests once wrote into the real `~/.claude`.
- **Test names are sentences**: `test("refuses a project scope when no project is selected", ...)`.
- Building a `FormData` in a test is fine and is the point: these functions take
  the same `FormData` the browser submits.

## Commands you will need

| Purpose   | Command                                         | Expected on success |
| --------- | ----------------------------------------------- | ------------------- |
| Install   | `bun install`                                   | exit 0              |
| Typecheck | `bun run typecheck`                             | exit 0, no output   |
| Lint      | `bun run lint`                                  | exit 0              |
| Tests     | `bun test`                                      | all pass, 0 fail    |
| One file  | `bun test src/lib/config/write-setting.test.ts` | all pass, 0 fail    |

A fresh worktree has no `node_modules`: run `bun install` first.

## Scope

**In scope**:

- `src/lib/config/write-setting.ts` + `.test.ts` (create)
- `src/lib/config/actions.ts` (reduce to a wrapper)
- `src/lib/items/change-state.ts` + `.test.ts` (create)
- `src/lib/items/actions.ts` (reduce to a wrapper)
- `src/lib/scope/add-project.ts` + `.test.ts` (create)
- `src/lib/scope/actions.ts` (reduce to a wrapper)

**Out of scope** (do NOT touch):

- `src/lib/history/actions.ts` and `src/lib/history/restore.ts` — plan 013 did
  this one already. Use it as the pattern; do not rework it.
- Any component under `src/components` or `src/app`. The action signatures
  (`(previous, formData) => Promise<State>`) and their exported names and state
  shapes must not change, so no caller needs editing. If you find yourself
  editing a `.tsx` file, you have changed a signature — stop.
- `src/lib/scope/scope.ts`, `src/lib/config/value-form.ts`,
  `src/lib/config/settings.ts` — already tested; reuse them, do not modify.
- Mocking `next/headers` or `next/cache`. If the answer seems to be a mock, the
  extraction boundary is in the wrong place.

## Git workflow

- Branch: `advisor/016-server-actions-have-tests`
- One commit per action extracted (three commits). Message style, from
  `git log`: one imperative sentence, no type prefix.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Read the pattern

Read `src/lib/history/restore.ts` and `src/lib/history/restore.test.ts` (created
by plan 013) and `src/lib/history/actions.ts` as it stands after that plan.

**Verify**: `test -f src/lib/history/restore.ts && echo ok` → `ok`. If the file
does not exist, plan 013 has not landed: STOP.

### Step 2: Extract `writeSetting`'s decision

Create `src/lib/config/write-setting.ts` exporting:

```ts
export type WriteSettingRequest =
  | {
      ok: true;
      scope: Scope;
      location: SettingsLocation;
      key: string;
      value: unknown;
      expected: ExpectedFile;
    }
  | { ok: false; error: string };

/**
 * What a submitted settings form asks for, decided without touching the disk or the
 * cookie store: the selection is passed in, so this is testable and the Server Action
 * stays a wrapper around it.
 */
export function readWriteSettingForm(
  formData: FormData,
  selected: ScopeSelection
): WriteSettingRequest;
```

Move the whole body of `writeSetting` up to and including the
`parseValueForSetting` check into it, unchanged in behaviour. Then reduce
`src/lib/config/actions.ts` to: `getSelectedScope()`, call
`readWriteSettingForm`, return `{ error }` on failure, otherwise `mutateSetting`,
`revalidatePath("/settings")`, return `{ ok: true }`.

Test in `src/lib/config/write-setting.test.ts` with a real `FormData`:

- refuses a missing or blank `key`
- refuses a `scope` that is not `user`, `project` or `local` (include `managed` and a junk string)
- refuses a project or local scope when the selection is the user scope
- builds `location.projectRoot` from a project selection, and leaves it undefined for the user scope
- `unset` present yields `value: undefined` whatever the value field says
- a bad value for a catalogued key is refused with the parser's message (use a real catalogued key — `getSetting("model")` and `getSetting("cleanupPeriodDays")` both exist at `9372dd4`; confirm with the catalog before relying on one)
- an uncatalogued key parses its value as JSON

**Verify**: `bun test src/lib/config/write-setting.test.ts` → all pass;
`bun run typecheck` → exit 0.

### Step 3: Extract `changeItemState`'s decision

Create `src/lib/items/change-state.ts` exporting `readChangeItemStateForm(formData, selected)`
returning either the validated arguments for `setItemState` (including the
`expectedSettings` / `expectedArchive` tokens plan 014 added) or `{ ok: false, error }`.
Reduce `src/lib/items/actions.ts` to a wrapper that also does `revalidatePath(PAGES[type])`.

Test in `src/lib/items/change-state.test.ts`:

- refuses a `type` that is not `mcp`, `skill` or `plugin`
- refuses an empty `name`
- refuses a `state` outside enabled/disabled/archived
- accepts each of the three states
- keeps `source` only when it is `user`, `project` or `local`, and drops junk to `undefined`
- derives scope `project` and `location.projectRoot` from a project selection, `user` otherwise
- decodes both expected-file tokens, and a missing token decodes to the never-matching `{ hash: "", mtimeMs: -1 }`

**Verify**: `bun test src/lib/items/change-state.test.ts` → all pass;
`bun run typecheck` → exit 0.

### Step 4: Extract `addProjectScope`'s decision

Create `src/lib/scope/add-project.ts`. Two functions, so the cookie work stays
in the action but the rules are testable:

```ts
/** The directory to add, or why it cannot be added. Checks the path; enumerates nothing. */
export async function checkProjectToAdd(
  path: string
): Promise<{ ok: true; path: string } | { ok: false; error: string }>;

/** The manual-projects list with `path` added, unchanged when it is already there. */
export function withManualProject(
  existing: readonly string[],
  path: string
): string[];
```

`checkProjectToAdd` holds the trim, the empty check and the `checkProjectDirectory`
call with its `MESSAGES` map (move the map into this file).
`src/lib/scope/actions.ts` keeps only the cookie writes and `revalidatePath`.

Test in `src/lib/scope/add-project.test.ts`, using `mkdtemp` for a real directory:

- refuses an empty or whitespace path
- refuses a relative path with "Enter an absolute path, starting with /."
- refuses a path that does not exist with "No such directory."
- refuses a file with "That path is a file, not a directory."
- accepts a real temporary directory
- `withManualProject` appends a new path, and returns an unchanged list for one already present

**Verify**: `bun test src/lib/scope/add-project.test.ts` → all pass;
`bun run typecheck` → exit 0.

### Step 5: Full gates

**Verify**: `bun test` → 0 fail; `bun run typecheck` → exit 0; `bun run lint` → exit 0;
`git status --short` lists only in-scope files.

## Test plan

- Three new test files, cases listed per step above.
- Structural pattern: `src/lib/history/restore.test.ts` (plan 013) and
  `src/lib/config/mutate.test.ts`.
- Every test builds its own `FormData` and passes an explicit `ScopeSelection`;
  no test reads a cookie, and none touches the real `~/.claude`.
- Verification: `bun test` → all pass, at least 20 new tests across the three files.

## Done criteria

ALL must hold:

- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun test` exits 0 with 0 failures
- [ ] These three files exist and pass: `src/lib/config/write-setting.test.ts`, `src/lib/items/change-state.test.ts`, `src/lib/scope/add-project.test.ts`
- [ ] `grep -rn "next/headers\|next/cache" src/lib/config/write-setting.ts src/lib/items/change-state.ts src/lib/scope/add-project.ts` returns no matches
- [ ] `grep -c "" src/lib/config/actions.ts` reports fewer than 45 lines (it is 59 at `9372dd4`)
- [ ] No file under `src/components` or `src/app` is modified (`git status --short`)
- [ ] `md5 -q ~/.claude/boopervisor.json` unchanged across a full `bun test` run

## STOP conditions

Stop and report back (do not improvise) if:

- `src/lib/history/restore.ts` does not exist — plan 013 has not landed and this
  plan's pattern is missing.
- The action files do not match the excerpts above (plans 013/014 changed them
  beyond the fields this plan expects) — re-read them and report the difference
  rather than guessing.
- An extraction would require changing an action's exported name, signature or
  state shape. Callers in `src/app` and `src/components` depend on those.
- You conclude a test needs `next/headers` mocked. Report instead: it means the
  boundary is wrong.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The shape to preserve: **a `"use server"` function reads context (cookies),
  calls a plain tested function, and revalidates. It contains no branching over
  user input.** Any new action should be written this way from the start.
- A reviewer should check the extracted functions take everything they need as
  arguments — a single `cookies()` call inside one of them undoes the plan.
- Deliberately deferred: `selectScope` (three lines, no branching worth a test)
  and end-to-end tests of the actions themselves, which would need a Next request
  context this repo has no harness for.
