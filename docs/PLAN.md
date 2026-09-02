# Boopervisor — agreed design

Settled through a design interview. Terms are defined in `../CONTEXT.md`; decisions with
non-obvious reasoning are in `adr/`.

## Scope

In scope: Claude Code's local configuration only — settings at user, project and
project-local scope, plus skills, plugins and MCP servers.

Out of scope, deliberately:

- **Anthropic Admin API** (organisations, workspaces, members, API keys, spend limits,
  usage and cost reports). A real HTTP API, but a different product with different
  authentication. Could become a clearly separate section later.
- **claude.ai account preferences** (model choice, memory, connectors, styles). No public API
  exists to read or write them.
- **Editing item content.** Boopervisor manages item state and metadata. `SKILL.md` bodies,
  `plugin.json` and hook scripts are shown read-only with a path to open them elsewhere.

## Architecture

- Next.js App Router, TypeScript, Tailwind, run locally via `bun dev`. Packaging it as a
  `bunx boopervisor` command that boots the server and opens a browser is the eventual shape,
  not a v1 requirement. It is never deployed remotely.
- Mutations go through Server Actions. Filesystem work is server-only, and form-level pending
  and error state comes free.
- All file-format knowledge lives in `src/lib/config/`, as pure functions over a directory
  path. That module is the actual product and is unit-tested against a temporary directory.
  Merge and precedence logic in particular is fully testable without a browser.
- Playwright is deferred.

## Reading and writing

- Files are read on request. No watching: a single-user local tool does not earn the
  machinery.
- Every mutation checks that the file has not changed since it was read, by mtime and hash,
  and refuses as a stale write if it has.
- Every mutation writes a backup first, to `~/.claude/.boopervisor-backups/`, named
  `<file>.<path digest>.<timestamp>.json` and pruned to the most recent 50 per file.
- A History page lists every mutation with a diff, and restores any backup in one action. A
  restore is itself a mutation, and is itself backed up.
- Known keys are validated against the catalog and invalid writes are refused. Unknown keys
  are preserved untouched and surfaced in the interface as uncatalogued.
- `~/.claude.json` holds user-scope MCP servers alongside project history, session state and
  onboarding flags, and Claude Code writes to it constantly. Boopervisor read-modify-writes
  only the `mcpServers` key and never reserialises the rest of the file.

## Interface

- A route per domain: `/settings`, `/skills`, `/plugins`, `/mcp`, plus `/history`.
- Master-detail within `/skills`, `/plugins` and `/mcp`: item list on the left, detail and
  state controls on the right. Each listing shows the selected scope's own items and not the
  user-level ones a project also inherits: the two are different scopes, the switcher says
  which one is selected, and inheritance can be assumed rather than restated. `/settings` is
  the exception, because a setting's whole point is the value that wins across scopes.
- A global scope switcher in the header — user, or a specific project — because it changes
  what every page shows. Projects come from the `projects` map in `~/.claude.json`, plus a
  manual directory picker for one that is not listed. Nothing is discovered by scanning the
  filesystem.
- `/settings` always shows the effective value for a key together with a per-scope breakdown
  of which scope set it. Editing targets the selected scope, and the breakdown makes it
  visible when a higher-precedence scope will override what was just typed. For a project,
  the page also chooses which of its two files an edit lands in, `.claude/settings.json` or
  `.claude/settings.local.json`; the choice travels in the URL.
- Managed settings are shown read-only.
- Scalars and enumerated keys get typed controls, and any key with enumerated values gets a
  dropdown. String arrays get a list editor. `permissions` and `hooks` get purpose-built
  editors, because they are edited most and a typo in either silently breaks Claude Code.
  `sandbox`, `env` and `pluginConfigs` get a validated JSON editor until they prove they need
  more.
- A key the catalog marks dangerous — one that runs a command or changes what Claude Code
  does unasked — asks for confirmation before it is written; every key shows the reference's
  type, default and per-session override alongside its value.

## Item state

Enabled, disabled and archived, uniformly across skills, plugins and MCP servers. Disabling
uses Claude Code's own mechanism for that item type. Archival is Boopervisor's own state and
does not move or alter the item's files — see ADR 0002.

## Design system

Vercel's Geist — https://vercel.com/geist/introduction. Vercel publishes no React component
package for it, so: the `geist` npm package for Geist Sans and Geist Mono, Geist's colour,
spacing, radius and shadow tokens transcribed into the Tailwind theme, and components built
on shadcn/ui's Radix primitives restyled to match. `@geist-ui/react` is an unaffiliated
community library and is archived; it is not used. Vercel's design.md is vendored as
`DESIGN.md` and governs everything the tokens do not.

## Order of work

1. A research pass over the settings reference to populate the catalog
   (`docs/settings-catalog.md` lists what it must answer).
2. `src/lib/config/` — read, merge, resolve effective values, validate, write with backup and
   stale-write detection. Tests first.
3. Geist token layer and the shared control set.
4. `/settings`, then `/mcp`, `/skills`, `/plugins`, then `/history`.
