# Plan 004: `/mcp` lists a project's local-scope servers from `~/.claude.json`, and shows Claude Code's own approval record for `.mcp.json` servers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 69744da..HEAD -- src/lib/config/mcp-servers.ts src/lib/config/mcp-servers.test.ts src/lib/items/mechanism.ts src/lib/items/mechanism.test.ts src/lib/items/set-state.ts src/lib/items/set-state.test.ts src/lib/items/state.ts src/lib/items/actions.ts src/lib/items/index.ts src/app/mcp/mcp-server-list.tsx src/app/mcp/page.tsx docs/verified-file-formats.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M (coarse — this is a direction plan: one verification spike, then a build)
- **Risk**: MED — touches how an MCP server's state is decided; mitigated by keeping every write on existing settings keys and adding nothing that writes `~/.claude.json`.
- **Depends on**: 002 (its tests archive items; must not leak into the real home)
- **Category**: direction
- **Planned at**: commit `69744da`, 2026-08-30

## Why this matters

`claude mcp add <name> …` with no `--scope` stores the server at **local** scope, and the
official reference (https://code.claude.com/docs/en/mcp, checked 2026-08-30) says where:

> Stored in `~/.claude.json` under your project's path:
> `{ "projects": { "/path/to/your/project": { "mcpServers": { "stripe": { ... } } } } }`

Boopervisor never reads that place. For a project it reads only `.mcp.json`
(`src/lib/config/mcp-servers.ts:629-648`), so the most common way a server gets added to a
project is invisible on `/mcp`. On the author's machine `~/.claude.json`'s `projects` entries
carry, among other keys, `mcpServers`, `enabledMcpjsonServers`, `disabledMcpjsonServers`
and `allowedTools` — the last three being where Claude Code records the outcome of its
".mcp.json server approval" dialog. Boopervisor decides a `.mcp.json` server's state from
the settings files alone, so a server the user approved in Claude Code's dialog can show as
"disabled" here, and vice versa.

`docs/verified-file-formats.md`'s "Still unverified" list already names the semantics of
`enabledMcpjsonServers` as unresolved. This plan closes what can be closed from the
documentation, records what remains corroboration, and builds the listing.

After this plan: for a project, `/mcp` lists servers from both `.mcp.json` (source
"project") and `~/.claude.json`'s project entry (source "local"), each saying which file it
came from; a `.mcp.json` server's detail shows Claude Code's own approval record when one
exists; and state controls work for local servers through the mechanism the spike confirms.

## Current state

Files:

- `src/lib/config/mcp-servers.ts` — `readUserScopeMcpServers(home)`, `readProjectScopeMcpServers(projectPath)`.
- `src/lib/config/mcp-servers.test.ts` — their tests (temp directories).
- `src/lib/items/mechanism.ts` — `DisablingMechanism`, `DENIED_MCP`, `DISABLED_MCPJSON`, `mechanismFor(type, scope)`, `isDisabledBySettings`, `whyDisabled`.
- `src/lib/items/state.ts` — `itemState(type, name, scope, resolution, project)`.
- `src/lib/items/set-state.ts` — `setItemState({ type, name, state, scope, location })`.
- `src/lib/items/actions.ts` — `changeItemState` Server Action; form fields `type`, `name`, `state`.
- `src/app/mcp/mcp-server-list.tsx` — the server component building the master-detail.
- `src/app/mcp/page.tsx` — reads `item` and `archived` search params.
- `src/lib/config/projects.ts` — `claudeJsonPath(home)`, `parseProjectPaths(text)` (already parses the `projects` map's keys).
- `docs/verified-file-formats.md` — where checked/unchecked assumptions are recorded.

`src/lib/config/mcp-servers.ts:605-624` — user scope reads top-level `mcpServers` only:

```ts
export async function readUserScopeMcpServers(
  home: string = homedir()
): Promise<Record<string, McpServer>> {
  const path = join(home, ".claude.json");
  try {
    const text = await readFile(path, "utf8");
    const { content } = parseJsonObject(text);
    const mcpServers = content.mcpServers;
```

`src/lib/items/mechanism.ts:208-216` — the source of a server is inferred from the scope:

```ts
/**
 * MCP servers are disabled differently depending on where they came from: a user-scope
 * server by name, a project's `.mcp.json` server by the key Claude Code has for exactly that.
 */
export function mechanismFor(type: ItemType, scope: Scope): DisablingMechanism {
  if (type === "skill") return SKILL_OVERRIDES;
  if (type === "plugin") return ENABLED_PLUGINS;
  return scope === "user" ? DENIED_MCP : DISABLED_MCPJSON;
}
```

`src/app/mcp/mcp-server-list.tsx:126-144` — one source per selection:

```tsx
const selected = await getSelectedScope();
const projectRoot = selected.kind === "project" ? selected.path : undefined;
const location: SettingsLocation = { projectRoot };
const scope = selected.kind === "project" ? "project" : "user";

const configurations =
  projectRoot === undefined
    ? await readUserScopeMcpServers()
    : await readProjectScopeMcpServers(projectRoot);
const resolution = await resolveEffectiveSettings(location);

const servers = await Promise.all(
  Object.entries(configurations).map(async ([name, configuration]) => ({
    name,
    configuration,
    state: await itemState("mcp", name, scope, resolution, projectRoot),
    disabledBy: whyDisabled("mcp", name, scope, resolution),
  }))
);
```

Catalog facts (from `src/lib/catalog/settings.data.json`, verified 2026-08-30):

- `deniedMcpServers` — scopes `user, project, local, managed`; "array of objects, each with
  exactly one key: `serverName`, any non-empty string …; `serverCommand` …; or `serverUrl` …".
- `disabledMcpjsonServers` / `enabledMcpjsonServers` — scopes `user, project, local, managed`;
  "array of strings, the server names as they appear in `.mcp.json`".
- `enableAllProjectMcpServers` — Boolean, same scopes.

What is **not** documented (agent check of mcp.md and settings-reference.md, 2026-08-30):
whether an unlisted `.mcp.json` server is disabled or merely pending approval; and the
`projects[path].enabledMcpjsonServers` / `disabledMcpjsonServers` keys in `~/.claude.json`
at all. Those are corroboration from one machine, and the doc's convention for such facts is
to say so ("corroboration is not a specification").

Design constraints to honour:

- `docs/PLAN.md`: "`~/.claude.json` … Boopervisor read-modify-writes only the `mcpServers`
  key and never reserialises the rest of the file." This plan **reads** the `projects` map and
  writes nothing to `~/.claude.json`.
- `docs/PLAN.md` interface section: each listing shows "the selected scope's own items and not
  the user-level ones a project also inherits". Local servers belong to the project, so they
  are listed for the project; do not list user-scope servers under a project.
- ADR 0002: disabling uses Claude Code's own mechanism; archival is Boopervisor's own file.
- Vocabulary (`CONTEXT.md`): **item**, **enabled/disabled/archived**, **scope**. For the
  "where did this server come from" notion, use **source** in code (`McpSource`) — it is not
  a scope in the catalog's sense and must not be called one.

## Commands you will need

| Purpose    | Command                                       | Expected                                            |
| ---------- | --------------------------------------------- | --------------------------------------------------- |
| Typecheck  | `bun run typecheck`                           | exit 0                                              |
| Lint       | `bun run lint`                                | exit 0                                              |
| One file   | `bun test src/lib/config/mcp-servers.test.ts` | 0 fail                                              |
| All        | `bun test`                                    | 0 fail                                              |
| Dev server | `bun dev`                                     | for a manual look at `/mcp` with a project selected |

## Suggested executor toolkit

- Read `AGENTS.md`, then `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md`
  and `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` before touching
  `mcp-server-list.tsx` or `actions.ts` — this Next.js differs from what you know.
- Docs: https://code.claude.com/docs/en/mcp.md and https://code.claude.com/docs/en/settings-reference.md#deniedmcpservers.

## Scope

**In scope**:

- `src/lib/config/mcp-servers.ts`, `src/lib/config/mcp-servers.test.ts`
- `src/lib/items/mechanism.ts`, `src/lib/items/mechanism.test.ts`
- `src/lib/items/state.ts`, `src/lib/items/set-state.ts`, `src/lib/items/set-state.test.ts`, `src/lib/items/actions.ts`, `src/lib/items/index.ts`
- `src/app/mcp/mcp-server-list.tsx`, `src/app/mcp/page.tsx`
- `docs/verified-file-formats.md`

**Out of scope**:

- Writing `~/.claude.json` for any reason. `mutateUserMcpServers` in `mcp-mutations.ts` exists and is unused by any page; leave it.
- `/skills`, `/plugins`, `master-detail.tsx`.
- Recognising `deniedMcpServers` entries keyed by `serverCommand` or `serverUrl` (separate, recorded in the docs as unverified).
- `enableAllProjectMcpServers` semantics beyond displaying its effective value.

## Git workflow

- Branch: `advisor/004-local-scope-mcp-servers`
- Commit per step; plain imperative sentence.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1 (spike): decide the disabling mechanism for a local-scope server

Fetch https://code.claude.com/docs/en/settings-reference.md and read the `deniedMcpServers`
and `disabledMcpjsonServers` entries, and https://code.claude.com/docs/en/mcp.md's scope
section. Answer, in a short note you will paste into Step 6's doc section:

- Q1: Does `deniedMcpServers` apply to servers regardless of where they are defined
  (`~/.claude.json` top level, `projects[path]`, `.mcp.json`)? The catalog text ("any
  non-empty string, so a claude.ai connector's display name … works") suggests it matches any
  server by name.
- Q2: Do `enabledMcpjsonServers` / `disabledMcpjsonServers` apply **only** to `.mcp.json`
  servers? (The catalog says "as they appear in `.mcp.json`" — expected answer yes.)

Decision rule: if Q1 is yes (or the docs do not contradict it), a local-scope server uses
`DENIED_MCP` written to the selected project's `.claude/settings.json`, and this plan's state
controls apply to local servers. If the docs say `deniedMcpServers` does **not** cover
locally scoped servers, local servers get **no state controls** in this plan (listing only,
with a note "Boopervisor lists this server; Claude Code documents no settings key that
disables a local-scope server. Use `claude mcp remove`."), and you record that in Step 6.

**Verify**: your two answers are written down with the doc URL each came from.

### Step 2: Read local-scope servers and the approval record

In `src/lib/config/mcp-servers.ts` add:

```ts
/** Where a project's server is defined. Not a settings scope: a source names a file. */
export type McpSource = "user" | "project" | "local";

/**
 * A project's local-scope servers: `projects[<path>].mcpServers` in `~/.claude.json`, which
 * is where `claude mcp add` puts a server by default. The map is keyed by the absolute
 * path as Claude Code recorded it; a trailing slash on the selection is not part of that key.
 */
export async function readLocalScopeMcpServers(
  projectPath: string,
  home: string = homedir()
): Promise<Record<string, McpServer>>;

/**
 * What Claude Code itself recorded about a project's `.mcp.json` servers after its approval
 * dialog: `projects[<path>].enabledMcpjsonServers` and `disabledMcpjsonServers`. Undocumented;
 * observed on one machine. Read for display, never written.
 */
export async function readMcpJsonApprovals(
  projectPath: string,
  home: string = homedir()
): Promise<{ enabled: string[]; disabled: string[] }>;
```

Both read `join(home, ".claude.json")`, parse with `parseJsonObject`, look up
`content.projects?.[projectPath.replace(/\/+$/, "")]`, and return empty results for anything
missing or malformed (match the existing functions' `try { … } catch { return {} }` style).
Add the `McpSource` type to `src/lib/items/index.ts` exports if `items` needs it (see Step 3).

Tests in `mcp-servers.test.ts` (temp home with a hand-written `.claude.json`):

- reads `projects[path].mcpServers`;
- returns `{}` when the project is not in the map, when `mcpServers` is absent, and when the file is missing;
- a selection path with a trailing slash still finds the entry;
- `readMcpJsonApprovals` returns both lists, and empty lists when absent.

**Verify**: `bun test src/lib/config/mcp-servers.test.ts` → 0 fail.

### Step 3: Let the mechanism be chosen by source, not inferred from scope

In `src/lib/items/mechanism.ts`:

- Add `export function mcpMechanismFor(source: McpSource): DisablingMechanism` returning
  `DISABLED_MCPJSON` for `"project"` and `DENIED_MCP` for `"user"` and `"local"` (per Step 1;
  if Step 1 said local servers get no controls, still return `DENIED_MCP` here — the page is
  what withholds the controls — but say so in a comment).
- Keep `mechanismFor(type, scope)` for skills and plugins and as the fallback for MCP when no
  source is given: `mechanismFor("mcp", scope)` ≡ `mcpMechanismFor(scope === "user" ? "user" : "project")`.
- Add an optional trailing `source?: McpSource` parameter to `isDisabledBySettings` and
  `whyDisabled`; when `type === "mcp"` and `source` is given, use `mcpMechanismFor(source)`.

In `src/lib/items/state.ts`, add the same optional trailing `source?: McpSource` to `itemState`
and pass it through.

In `src/lib/items/set-state.ts`, add optional `source?: McpSource` to `setItemState`'s options
and to `writeDisabled`; choose the mechanism the same way. Archival keys stay
`itemKey(type, scope, name, project)` — a local and a `.mcp.json` server with the same name in
the same project would share an archive key; include the source in the name you pass for local
servers (`local:<name>`) to keep them apart, and document that in a one-line comment.

In `src/lib/items/actions.ts`, read an optional `source` form field, accept only
`"user" | "project" | "local"`, and pass it to `setItemState`.

Tests: `mechanism.test.ts` — `mcpMechanismFor("local").key === "deniedMcpServers"`,
`mcpMechanismFor("project").key === "disabledMcpjsonServers"`, and `mechanismFor("mcp", "project")`
unchanged. `set-state.test.ts` — disabling a local server at project scope writes
`deniedMcpServers: [{ serverName }]` to the project's `.claude/settings.json` (build the
location with `makeLocation` as the file already does; the project file path is
`settingFilePath("project", location)`).

**Verify**: `bun run typecheck` → 0; `bun test src/lib/items` → 0 fail.

### Step 4: List both sources on `/mcp` for a project

In `src/app/mcp/mcp-server-list.tsx`:

- For the user selection: unchanged (source `"user"`).
- For a project: read `readProjectScopeMcpServers(projectRoot)` as source `"project"` and
  `readLocalScopeMcpServers(projectRoot)` as source `"local"`, and `readMcpJsonApprovals(projectRoot)`.
- Build one array of `{ id, name, source, file, configuration, state, disabledBy }` where
  `id = \`${source}:${name}\``(the URL carries it),`file`is`${projectRoot}/.mcp.json`or`~/.claude.json`, and `state`/`disabledBy`come from`itemState`/`whyDisabled`with`source`.
- `MasterDetailItem.detail` = `"Project (.mcp.json)"` or `"Local (~/.claude.json)"`.
- Detail panel: keep the existing layout; the file line shows `file`; pass `source` as a hidden
  field in `ItemStateControls`' `fields`. For a `.mcp.json` server, add a short block under
  Configuration: "Claude Code's own record" — "Approved in Claude Code's dialog" if the name
  is in `approvals.enabled`, "Rejected in Claude Code's dialog" if in `approvals.disabled`,
  else "No record yet" — with a one-line note that this comes from `~/.claude.json` and is
  observed, not documented. Do **not** let it change `state`; it is information.
- If Step 1 withheld controls for local servers, render the note instead of
  `ItemStateControls` for `source === "local"`.
- Empty text for a project: "This project has no MCP servers in .mcp.json or in ~/.claude.json."

`src/app/mcp/page.tsx` needs no change unless you rename the `item` param; keep it.

**Verify**: `bun run typecheck` → 0; `bun run lint` → 0; then `bun dev`, select a project in
the header, open `/mcp` — a project with a local server (create one in a scratch project with
`claude mcp add test-local -- echo hi`, if the `claude` CLI is available; otherwise write the
entry into a temp copy is not possible, so verify with the unit tests only) lists it with
detail "Local (~/.claude.json)". Stop the server.

### Step 5: Tests for the page-level logic

The list is a server component reading cookies; do not test it with the DOM. Instead extract
the pure part — building the items array from `{ project, local }` maps and an approvals record
into `{ id, name, source, file }` rows — into an exported function in
`src/lib/config/mcp-servers.ts` (e.g. `listProjectMcpServers(project, local, projectRoot)`),
and test it: ids are prefixed by source; a name present in both sources yields two rows;
`file` is right for each.

**Verify**: `bun test src/lib/config/mcp-servers.test.ts` → 0 fail.

### Step 6: Record what was verified

In `docs/verified-file-formats.md`:

- Add a section `## Where a project's MCP servers live` stating: `.mcp.json` at the project
  root (documented); local scope at `projects[<path>].mcpServers` in `~/.claude.json`
  (documented, quote the mcp.md line); the approval record keys under the same entry
  (observed on one machine, undocumented). Paste your Step 1 answers with their URLs.
- In "Still unverified", replace the `enabledMcpjsonServers` bullet with whatever remains
  unverified after Step 1 (at minimum: whether "unlisted" means disabled or pending).

**Verify**: `grep -n "## Where a project's MCP servers live" docs/verified-file-formats.md` → one match.

### Step 7: Full gates

**Verify**: `bun run typecheck` → 0; `bun run lint` → 0; `bun test` → 0 fail.

## Test plan

Steps 2, 3 and 5. Patterns: `mcp-servers.test.ts` (temp home, hand-written JSON),
`set-state.test.ts` (`makeLocation`), `mechanism.test.ts`. Verification: `bun test` → 0 fail
with the new cases named above present.

## Done criteria

- [ ] `bun run typecheck`, `bun run lint`, `bun test` exit 0
- [ ] `grep -n "readLocalScopeMcpServers\|readMcpJsonApprovals" src/lib/config/mcp-servers.ts` → both defined
- [ ] `grep -n "mcpMechanismFor" src/lib/items/mechanism.ts` → defined and used
- [ ] `grep -n "Local (~/.claude.json)" src/app/mcp/mcp-server-list.tsx` → one match
- [ ] `grep -rn "mutateUserMcpServers" src/app` → no matches (nothing writes `~/.claude.json`)
- [ ] `docs/verified-file-formats.md` has the new section and an updated "Still unverified"
- [ ] `git status --porcelain` lists only in-scope files (and `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Excerpts do not match the live code.
- Plan 002 is not DONE (its tests would archive into the real home).
- The docs in Step 1 say `deniedMcpServers` is managed-only or otherwise cannot be written at
  project scope — report; do not invent another mechanism.
- Supporting local servers turns out to require writing `~/.claude.json`.
- A step's verification fails twice.

## Maintenance notes

- `id` on `/mcp` is now `source:name`; any link into `/mcp?item=` must use that form.
- The approval record is undocumented. If Claude Code renames those keys the block shows "No
  record yet", which is safe. Reviewer: confirm nothing derives `state` from it.
- Deferred: `deniedMcpServers` entries by `serverCommand`/`serverUrl`; user-scope servers'
  visibility under a project (deliberately not listed, per `docs/PLAN.md`).

## Reconciliation (2026-09-01, HEAD `484309b`)

Drift since `69744da` reviewed by the advisor; all benign, the plan stands. Deltas an
executor must honour:

- `src/lib/items/set-state.ts` (plan 002): `writeArchived` now calls
  `archivedItemsPath(location.homeDir)` and passes `homeDir: location.homeDir` into the
  mutation. Preserve both when adding `source`.
- `src/lib/items/set-state.test.ts` (plan 002): `makeLocation` creates an isolated home;
  a test asserts archival lands under `location.homeDir`. Model new tests on the current file.
- `src/app/mcp/mcp-server-list.tsx` (plan 009): detail-panel prose is `text-sm`, not
  `text-xs`. Any new UI text uses `text-sm`.
- `docs/verified-file-formats.md` (plan 001): gained "## The hooks key" and a table row.
  "Still unverified" now holds two bullets; Step 6 replaces the `enabledMcpjsonServers` one
  and keeps the `installed_plugins.json` one.
- `src/app/design-tokens.test.ts` (plans 007/009) bans non-Geist colour/radius classes and
  `text-gray-700/800` text. New UI must pass `bun test src/app/design-tokens.test.ts`.
- Plan 003 also edits `mechanism.ts`/`mechanism.test.ts` on branch
  `advisor/003-localhost-and-doc-drift`; if that branch exists, merge it into this plan's
  branch before starting.
