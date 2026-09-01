# Plan 015: The dead `mcp-mutations` module is gone, and the format guarantees it tested are kept

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9372dd4..HEAD -- src/lib/config/mcp-mutations.ts src/lib/config/mcp-mutations.test.ts src/lib/config/mcp-mutations-integration.test.ts src/lib/config/mutate.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `9372dd4`, 2026-09-01

## Why this matters

`src/lib/config/mcp-mutations.ts` exports three functions —
`mutateUserMcpServers`, `archiveMcpServer`, `unarchiveMcpServer` — and nothing
in the application calls any of them. 127 lines of code and 335 lines of tests
run green on every commit while testing nothing that ships.

That would be mere clutter if the module agreed with the code that _is_ live.
It does not. `archiveMcpServer` writes its archive record under the key
`` `mcp:${scope}:${serverName}` ``, ignoring both the project and the source.
The live path builds keys with `itemKey` and `archivalName`, whose doc comment
(`src/lib/items/item-state.ts:61-66`) warns:

> A local-scope MCP server and a project's `.mcp.json` server can share a name
> in the same project, so the archive key must not conflate them — a local
> server's archive name carries its source. **Every caller that reads or writes
> archival state for an MCP server must go through this**, or the two can
> shadow each other.

So the dead module is not neutral: it is a working-looking, tested,
importable function that writes keys the reader will never find. The first
person to wire it up reintroduces the bug plan 004 already fixed once.

Two of its tests are worth keeping, though. The integration test asserts that a
write to a realistic `~/.claude.json` preserves every other field, its key order
and its indentation — which is `mutateJsonFile`'s core promise
(`src/lib/config/mutate.ts:84-89`) and the mitigation ADR 0001 relies on. Those
assertions should move to `mutate.test.ts`, where they will keep running against
live code.

After this plan: the module and its tests are gone, and the format-preservation
guarantees are tested where they belong.

## Current state

- `src/lib/config/mcp-mutations.ts` — 127 lines, three exports, zero production callers.
- `src/lib/config/mcp-mutations.test.ts` — 188 lines: `mutateUserMcpServers` (4 tests), `archiveMcpServer` (2), `unarchiveMcpServer` (1).
- `src/lib/config/mcp-mutations-integration.test.ts` — 147 lines, 2 tests: "preserves all fields, indentation, and order when modifying mcpServers" and "handles quirky key order and indentation variations".
- `src/lib/config/mutate.test.ts` — the tests for the live write path; where the ported tests go.

Proof the module is dead (run it yourself in step 1):

```
$ grep -rn "mcp-mutations\|mutateUserMcpServers\|archiveMcpServer\|unarchiveMcpServer" src --include=*.ts --include=*.tsx
```

At `9372dd4` this returns only `src/lib/config/mcp-mutations.ts` itself and its
two test files.

The conflicting key, `src/lib/config/mcp-mutations.ts:82`:

```ts
const key = `mcp:${scope}:${serverName}`;
```

versus the live key builder, `src/lib/items/item-state.ts:78-88`:

```ts
export function itemKey(
  type: ItemType,
  scope: Scope,
  name: string,
  project?: string
): string {
  if (project) {
    return `${type}:${scope}:${project}:${name}`;
  }
  return `${type}:${scope}:${name}`;
}
```

The live archival write is `writeArchived` in `src/lib/items/set-state.ts:103-144`,
which uses `itemKey(type, scope, name, location.projectRoot)` — the path
everything actually goes through.

### Conventions to match

- Tests use real temporary directories via `mkdtemp`, never mocks, and never
  the real home. `src/lib/config/mutate.test.ts:27-37` is the pattern:

  ```ts
  async function makeHome(
    contents?: string
  ): Promise<{ homeDir: string; path: string }> {
    const homeDir = await mkdtemp(join(tmpdir(), "boopervisor-mutate-"));
    const path = join(homeDir, ".claude", "settings.json");
    ...
  }
  ```

- Test names are sentences describing a behaviour, e.g.
  `test("an absent file snapshots as absent rather than failing", ...)`.

- `docs/adr/0001-write-config-files-directly.md` states the guarantee the ported
  tests protect: "the file-format knowledge lives in one module with tests that
  operate on a temporary directory, so drift shows up as a failing test rather
  than a corrupted config."

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

- `src/lib/config/mutate.test.ts` (add the ported tests)
- `src/lib/config/mcp-mutations.ts` (delete)
- `src/lib/config/mcp-mutations.test.ts` (delete)
- `src/lib/config/mcp-mutations-integration.test.ts` (delete)

**Out of scope** (do NOT touch):

- `src/lib/items/set-state.ts`, `src/lib/items/item-state.ts` — the live
  archival path is correct; this plan removes the module that disagrees with it,
  it does not change the survivor.
- `src/lib/config/mutate.ts` — no production code changes in this plan at all.
- Building a replacement `~/.claude.json` writer. Whether Boopervisor should
  edit MCP server definitions is an open product question recorded in
  `plans/README.md`; deleting dead code does not prejudge it, and the git history
  keeps the implementation if it is ever wanted.

## Git workflow

- Branch: `advisor/015-remove-the-dead-mcp-mutations-module`
- Two commits: one porting the tests, one deleting. Message style, from
  `git log`: one imperative sentence, no type prefix.
- Delete with `git rm` so the removal is staged as a deletion.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm the module is dead

```
grep -rn "mcp-mutations\|mutateUserMcpServers\|archiveMcpServer\|unarchiveMcpServer" src --include=*.ts --include=*.tsx
```

**Verify**: the only files listed are `src/lib/config/mcp-mutations.ts`,
`src/lib/config/mcp-mutations.test.ts` and
`src/lib/config/mcp-mutations-integration.test.ts`. If any other file appears,
that is a STOP condition.

### Step 2: Port the format-preservation tests

Read `src/lib/config/mcp-mutations-integration.test.ts` in full. It builds a
realistic `~/.claude.json` fixture and asserts that changing one nested key
leaves everything else — fields, order, indentation, trailing newline —
byte-identical.

Add an equivalent `describe("preserves a file it does not own", ...)` block to
`src/lib/config/mutate.test.ts`, calling `mutateJsonFile` **directly** with an
`apply` that replaces the `mcpServers` key, against the same style of fixture.
Two tests, matching the originals:

- a realistic multi-key file keeps every other field, its key order and its
  indentation when one nested key changes
- a file with unusual key order and indentation (tabs, four spaces, no trailing
  newline) round-trips in its own shape

Keep the fixture inline in the test file, as the original does. Do not import
anything from `mcp-mutations`.

**Verify**: `bun test src/lib/config/mutate.test.ts` → all pass, 0 fail, two
more tests than before.

### Step 3: Delete the module and its tests

```
git rm src/lib/config/mcp-mutations.ts src/lib/config/mcp-mutations.test.ts src/lib/config/mcp-mutations-integration.test.ts
```

**Verify**:

- `bun run typecheck` → exit 0 (nothing imported it).
- `bun run lint` → exit 0.
- `grep -rn "mcp-mutations" src` → no matches.

### Step 4: Full gates

**Verify**: `bun test` → 0 fail. Expect the total to _drop_: 350 tests at
`9372dd4`, minus the 9 deleted, plus the 2 ported — 343 or thereabouts. A drop
of exactly the deleted tests plus your additions is correct; any _failure_ is not.

## Test plan

- Two tests ported into `src/lib/config/mutate.test.ts` as described in step 2.
- Structural pattern: the existing `describe` blocks in that same file.
- Nine tests are deliberately removed with the module they tested.
- Verification: `bun test` → all pass.

## Done criteria

ALL must hold:

- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun test` exits 0 with 0 failures
- [ ] `grep -rn "mcp-mutations\|mutateUserMcpServers\|archiveMcpServer\|unarchiveMcpServer" src` returns no matches
- [ ] `src/lib/config/mutate.test.ts` contains two tests asserting field, order and indentation preservation on a realistic `~/.claude.json`-shaped file
- [ ] `git status --short` shows exactly three deletions and one modification
- [ ] `md5 -q ~/.claude/boopervisor.json` unchanged across a full `bun test` run

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1's grep finds a caller outside the three files — the module is not dead
  and this plan is wrong.
- Deleting the files breaks typecheck, which would mean something imports a
  _type_ from the module that the grep missed. Report the importer; do not
  re-export the type from somewhere else to make it compile.
- The ported tests fail against `mutateJsonFile` directly. That would mean a
  real format-preservation defect in live code, which is a finding, not
  something to work around by weakening the assertions.

## Maintenance notes

- If Boopervisor ever gains the ability to edit MCP server _definitions_, the
  deleted module is in git history at `9372dd4` — but its archive keys must be
  rebuilt on `itemKey`/`archivalName` rather than copied.
- A reviewer should check that the ported tests assert on the file's **text**
  (order, indentation, trailing newline), not just on its parsed value; parsing
  hides exactly the regressions these tests exist to catch.
- What this plan removes is the second implementation of archival. There should
  only ever be one, in `src/lib/items/`.
