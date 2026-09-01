# Plan 003: The server listens on localhost only, and the code matches what the docs say was corrected

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 69744da..HEAD -- package.json README.md src/lib/config/settings.ts src/lib/config/settings.test.ts src/lib/items/mechanism.ts src/lib/items/mechanism.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1 (the bind address) / P3 (the drifts)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security (bind address), bug (drifts), docs (README status)
- **Planned at**: commit `69744da`, 2026-08-30

## Why this matters

Three small things, batched because each is a one-line change with a one-line test:

1. **Bind address.** Boopervisor writes to `~/.claude` with no authentication; its safety
   rests on being a local tool ("It is never deployed remotely" — `docs/PLAN.md:27-29`). But
   `next dev` and `next start` listen on `0.0.0.0` by default (this repo's Next docs,
   `node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md:71` and `:122`:
   "Default: 0.0.0.0"). On a shared network, anyone who can reach port 3000 can drive every
   Server Action. Next's Server Action CSRF check compares `Origin` to `Host`, which protects
   against a hostile _website_ but not against a direct request from another machine. Binding
   to `127.0.0.1` closes this.
2. **Windows managed-settings path.** `docs/verified-file-formats.md` records that
   `C:\ProgramData\ClaudeCode\managed-settings.json` was wrong ("that is the legacy path
   Claude Code does not read") and marks it "Corrected to `C:\Program Files\ClaudeCode\`".
   The code still returns the ProgramData path. Re-verified against
   https://code.claude.com/docs/en/managed-settings on 2026-08-30: `C:\Program Files\ClaudeCode\managed-settings.json`.
3. **`skillOverrides: "hidden"`.** The same doc records "There is no `"hidden"`"; the code
   still treats it as disabling. Harmless today, but the doc claims a correction the code
   does not have, and a stale ADR-style record is worse than none.
4. **README status.** `README.md:12` says "Scaffolded. Nothing is implemented yet." The
   application is built.

## Current state

`package.json:5-8`:

```json
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
```

`README.md:10-13`:

```
## Status

Scaffolded. Nothing is implemented yet. See `docs/PLAN.md` for the agreed design and
`docs/adr/` for the decisions that are settled.
```

`README.md:17-22` (the Running section, for the localhost note):

```
bun install
bun dev
```

Then open http://localhost:3000.

`src/lib/config/settings.ts:140-148`:

```ts
export function managedSettingsPath(
  platform: NodeJS.Platform = process.platform
): string {
  if (platform === "darwin")
    return "/Library/Application Support/ClaudeCode/managed-settings.json";
  if (platform === "win32")
    return "C:\\ProgramData\\ClaudeCode\\managed-settings.json";
  return "/etc/claude-code/managed-settings.json";
}
```

`src/lib/items/mechanism.ts:184-194`:

```ts
const SKILL_OVERRIDES: DisablingMechanism = {
  key: "skillOverrides",
  disables: (value, name) =>
    asObject(value)[name] === "off" || asObject(value)[name] === "hidden",
```

`docs/verified-file-formats.md`, table "What this changed", already carries both corrections
as done. Do not edit that doc; make the code true to it.

At the planned-at commit, `grep -rn "ProgramData\|Program Files\|\"hidden\"" src --include='*.test.ts'`
returns nothing: neither behaviour is tested.

Conventions: tests next to the module with `bun:test`; see `src/lib/config/settings.test.ts`
and `src/lib/items/mechanism.test.ts` for the existing `describe` layout.

## Commands you will need

| Purpose                                | Command                            | Expected on success                |
| -------------------------------------- | ---------------------------------- | ---------------------------------- |
| Typecheck                              | `bun run typecheck`                | exit 0                             |
| Lint                                   | `bun run lint`                     | exit 0                             |
| Tests                                  | `bun test`                         | 0 fail                             |
| Dev server (background, for one check) | `bun dev`                          | prints a `Local:` URL              |
| Listening address                      | `lsof -nP -iTCP:3000 -sTCP:LISTEN` | one line, address `127.0.0.1:3000` |

## Scope

**In scope**:

- `package.json` (two script lines)
- `README.md` (Status paragraph; one sentence in Running)
- `src/lib/config/settings.ts` (one string)
- `src/lib/config/settings.test.ts` (one `describe`)
- `src/lib/items/mechanism.ts` (one expression)
- `src/lib/items/mechanism.test.ts` (one or two tests)

**Out of scope**:

- `docs/verified-file-formats.md` — already correct.
- `next.config.ts` — the bind address is a CLI flag, not config.
- Any authentication layer — a bound-to-localhost single-user tool does not need one; do not add tokens or passwords.
- `bun.lock`, dependencies.

## Git workflow

- Branch: `advisor/003-localhost-and-doc-drift`
- Commit message: plain imperative sentence.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Bind to localhost

In `package.json`, change `"dev": "next dev"` to `"dev": "next dev -H 127.0.0.1"` and
`"start": "next start"` to `"start": "next start -H 127.0.0.1"`.

In `README.md`, after "Then open http://localhost:3000.", add:
"The server listens on 127.0.0.1 only: it edits files under your home directory and must
not be reachable from other machines."

**Verify**: start `bun dev` in the background, wait for the `Local:` line, run
`lsof -nP -iTCP:3000 -sTCP:LISTEN` → exactly one LISTEN line and its name column reads
`127.0.0.1:3000` (not `*:3000`). Stop the server. If port 3000 is busy, Next picks another
port and prints it; use that port in `lsof`.

### Step 2: Windows managed-settings path

In `src/lib/config/settings.ts`, change the `win32` return to
`"C:\\Program Files\\ClaudeCode\\managed-settings.json"`.

In `src/lib/config/settings.test.ts`, add:

```ts
describe("managedSettingsPath", () => {
  test("names the documented location on each platform", () => {
    expect(managedSettingsPath("darwin")).toBe(
      "/Library/Application Support/ClaudeCode/managed-settings.json"
    );
    expect(managedSettingsPath("linux")).toBe(
      "/etc/claude-code/managed-settings.json"
    );
    // The ProgramData path is the legacy one Claude Code does not read.
    expect(managedSettingsPath("win32")).toBe(
      "C:\\Program Files\\ClaudeCode\\managed-settings.json"
    );
  });
});
```

(Import `managedSettingsPath` from `./settings` alongside the file's existing imports.)

**Verify**: `bun test src/lib/config/settings.test.ts` → 0 fail; `grep -rn ProgramData src` → no matches.

### Step 3: Only `"off"` disables a skill

In `src/lib/items/mechanism.ts`, change the `disables` expression to
`asObject(value)[name] === "off"`.

In `src/lib/items/mechanism.test.ts`, add to the skills `describe` (or create one modelled
on the file's others):

```ts
test('only "off" disables a skill; the narrowing states do not', () => {
  const mechanism = mechanismFor("skill", "user");
  expect(mechanism.disables({ caveman: "off" }, "caveman")).toBe(true);
  expect(mechanism.disables({ caveman: "name-only" }, "caveman")).toBe(false);
  expect(
    mechanism.disables({ caveman: "user-invocable-only" }, "caveman")
  ).toBe(false);
  expect(mechanism.disables({ caveman: "hidden" }, "caveman")).toBe(false);
});
```

**Verify**: `bun test src/lib/items/mechanism.test.ts` → 0 fail; `grep -n '"hidden"' src/lib/items/mechanism.ts` → no matches.

### Step 4: README status

Replace the Status paragraph with:

```
## Status

Working, for a single user on one machine: settings at every scope, skills, plugins, MCP
servers and a history with restore. See `docs/PLAN.md` for the agreed design, `docs/adr/`
for the decisions that are settled, and `docs/verified-file-formats.md` for which
assumptions about Claude Code's files have been checked.
```

**Verify**: `grep -n "Nothing is implemented" README.md` → no matches.

### Step 5: Full gates

**Verify**: `bun run typecheck` → 0; `bun run lint` → 0; `bun test` → 0 fail.

## Test plan

Steps 2 and 3 add the tests. Verification: `bun test` → 0 fail, 2 new tests.

## Done criteria

- [ ] `bun run typecheck`, `bun run lint`, `bun test` all exit 0
- [ ] `grep -n '"dev": "next dev -H 127.0.0.1"' package.json` → one match; same for `start`
- [ ] `lsof` check in Step 1 showed `127.0.0.1:<port>`
- [ ] `grep -rn ProgramData src` → no matches
- [ ] `grep -n '"hidden"' src/lib/items/mechanism.ts` → no matches
- [ ] `grep -n "Nothing is implemented" README.md` → no matches
- [ ] `git status --porcelain` lists only in-scope files (and `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Excerpts do not match the live code.
- `next dev -H 127.0.0.1` fails to start or Next reports the flag as unknown (the CLI docs at
  the planned-at version list `-H, --hostname`; if that changed, report rather than
  switching to an env var).
- A step's verification fails twice.

## Maintenance notes

- If Boopervisor is ever packaged as a `bunx boopervisor` command (deferred in `docs/PLAN.md`),
  the launcher must pass the same `-H 127.0.0.1`; the flag lives in scripts, not config, so
  it will not travel automatically.
- `docs/verified-file-formats.md` is the record of checked assumptions. When it says
  "Corrected", a reviewer should be able to grep the code and find the correction.
