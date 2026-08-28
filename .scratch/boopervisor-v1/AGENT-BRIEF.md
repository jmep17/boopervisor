# Shared brief for Boopervisor ticket agents

Repo: /Users/jorden/src/boopervisor. Read first, in this order:

- `AGENTS.md` (Next.js in this repo is NOT the one you know — read `node_modules/next/dist/docs/` before writing any Next code)
- `CONTEXT.md` — the domain vocabulary. Use these words exactly; the _Avoid_ lists are enforced in review.
- `docs/PLAN.md`, `docs/adr/*.md`, `docs/settings-catalog.md`
- Your ticket in `.scratch/boopervisor-v1/issues/`

## Existing code you must reuse, not re-invent

- `src/lib/catalog/` — the settings + hooks catalog. `SETTINGS`, `getSetting`, `isUncatalogued`, `settingsByTopic`, types incl. `Control`, `Scope`, `PRECEDENCE`, `SCOPE_FILES`. Generated data JSON is committed; never hand-edit it — corrections go in `overrides.ts` with a `note`.
- `src/lib/scope/` — `ScopeSelection`, `getSelectedScope()`, `getScopeState()` (server-only, cookie-backed), `selectScope` action.
- `src/lib/config/` — pure functions over a directory path. All file-format knowledge lives here.
- `src/components/ui/` — button, input, textarea, select, checkbox, switch, badge, dialog, field. `Field` does the aria plumbing via `useFieldControl`. Shared control skin in `control.ts`.
- `src/components/page-header.tsx`, `app-header.tsx`.
- Geist tokens are Tailwind theme values (`text-gray-1000`, `bg-background-100`, `rounded-base`, ...). No hardcoded hex.

## How to work

- TDD at the seams: pure logic in `src/lib/**` gets `*.test.ts` written first, run against a temp directory (`mkdtemp` in `tmpdir()`), no browser. Components get `*.test.tsx` with @testing-library/react. Follow the style of `src/lib/config/projects.test.ts` and `src/components/ui/button.test.tsx`.
- `bun test` (bun's runner, `import { describe, expect, test } from "bun:test"`), `bun run typecheck`, `bun run lint`. Run typecheck + your own test file often; full `bun test` before you finish. All three must pass.
- Mutations go through Server Actions. Filesystem work is server-only.
- Comments explain _why_, sparingly, in the voice of the existing code. Match its density.
- Do NOT commit. Do NOT touch files outside the ones your ticket owns (listed in your prompt). Do not run `git checkout`/`reset`/`stash`.
- Report back: files added/changed, decisions taken, anything you left undone.

## Seams for later tickets (tickets 03 and 04 are done — reuse these, do not fork them)

### `src/lib/config/json-file.ts`

- `type JsonObject = Record<string, unknown>`
- `type FileState = "ok" | "missing" | "empty" | "invalid-json"`
- `FileSnapshot` — `{ path, exists, mtimeMs, hash, text, content, state }`. The hash is of the file's raw bytes.
- `captureFileSnapshot(path): Promise<FileSnapshot>` — an absent file snapshots as `exists: false`, never throws.
- `parseJsonObject(text)`, `serializeLike(content, originalText)`, `detectIndent(text)` — writing preserves the file's own indentation and trailing newline.

### `src/lib/config/mutate.ts` — THE write path. Every write goes through it.

- `mutateJsonFile({ path, expected, target, apply, validate?, homeDir? }): Promise<MutationResult>`
  - `expected: ExpectedFile` (`{ hash, mtimeMs }`) — what the page read. A file that no longer matches is refused as `problem: "stale"`. A file that is not parseable JSON is refused as `"invalid"` and never overwritten.
  - `apply: (content: JsonObject) => JsonObject` — pure. Touch only your key; everything else keeps its value, order and formatting. This is how ticket 08 changes only `mcpServers` in `~/.claude.json`.
  - `validate?: (next: JsonObject) => ValidationResult` — refuses before anything is written.
  - `target: MutationTarget` — what `/history` shows. Extend the union in `mutations.ts` if your ticket needs a new kind.
  - Backs up to `~/.claude/.boopervisor-backups/<file>.<timestamp>.json`, pruned to `BACKUP_LIMIT` (50) per file, and appends to the mutation log. Both are automatic — do not do them yourself.
  - Returns `{ ok: true, backupPath, record }` or `{ ok: false, problem: "stale" | "invalid" | "io-error", message }`. It does not throw for expected failures.
- `encodeExpectedFile` / `decodeExpectedFile` — the token a form carries. Never put a `FileSnapshot` in the DOM: it holds the file's contents.
- `backupDirectory(homeDir?)`, `BACKUP_LIMIT`.

### `src/lib/config/mutations.ts` — the log `/history` reads

- `MutationRecord` — `{ timestamp, target, path, backupPath, before, after }`, before/after being the file's whole text.
- `MutationTarget` — `{ kind: "setting" | "item" | "restore", ... }`.
- `readMutationLog(homeDir?): Promise<MutationRecord[]>` — newest first. `appendMutationLog(record, homeDir?)`.

### `src/lib/config/settings.ts`

- `SettingsLocation` — `{ projectRoot?, homeDir?, managedPath? }`. Every function takes one, which is how the whole module is tested against a temporary directory. Pass `{ projectRoot }` in real use.
- `settingFilePath(scope, location)`, `managedSettingsPath(platform?)`, `scopesFor(location)`, `readSettingsFile(path)`, `readScopeSettings(scope, location)`.
- `resolveEffectiveSettings(location): Promise<SettingsResolution>` — `{ effectiveValues, fileStatuses, parsed }`.
- `resolveKey(key, scopes, parsed): EffectiveValue` — `{ key, effectiveValue, winningScope, perScope }`. Works for a key set nowhere.
- `isOverridden(effective, editing)` — true when a higher-precedence scope already sets the key.

### `src/lib/config/mutate-setting.ts` — settings writes

- `mutateSetting({ scope, location, key, value, expected })` — validates against the catalog, then calls `mutateJsonFile`. `value: undefined` unsets the key. Managed is refused.
- `snapshotScope(scope, location): Promise<FileSnapshot>`.

### `src/lib/config/validate.ts` and `value-form.ts`

- `validateSetting(value, definition): ValidationResult` — `{ ok: true }` or `{ ok: false, problem }`. Tickets 05/06/07 extend this; keep the shape.
- `parseValueForSetting(text, definition, unset?)` — one form field to the value a setting holds.

### `src/lib/config/actions.ts`

- `writeSetting(previous, formData)` — the Server Action `/settings` submits to. Fields: `key`, `scope`, `expected`, `value`, optional `unset`.

### `src/components/settings/`

- `SettingsList` (server) groups by topic and renders `SettingRow` (client). `SCOPE_LABELS` in `scope-labels.ts` names the scopes in precedence order.
- `SettingRow`'s `SettingControl` is deliberately minimal: ticket 05 replaces it with the full typed control set.

## Item state store (ticket 08)

Boopervisor's own archival state for items (MCP servers, skills, plugins). Disabling/enabling uses Claude Code's settings-based mechanisms, not Boopervisor's own files. Tickets 09 and 10 reuse the archival store and master-detail component.

### `src/lib/items/item-state.ts`

- `type ItemType = "mcp" | "skill" | "plugin"` — what kind of item
- `interface ArchivedItem` — `{ type, scope, project?, name, archivedAt: ISO8601 }`. Keyed by type, scope, project, and name.
- `interface ItemStateStore` — `{ archivedItems: Record<string, ArchivedItem> }`. The full store from `~/.claude/boopervisor.json`.
- `archivedItemsPath(home?): string` — path to `~/.claude/boopervisor.json`.
- `readItemState(home?): Promise<ItemStateStore>` — read the archive.
- `isArchived(type, scope, name, project?, home?): Promise<boolean>` — check if an item is archived.
- `archiveItem(type, scope, name, project?, home?): Promise<{ snapshot }>` — record archival.
- `unarchiveItem(type, scope, name, project?, home?): Promise<{ snapshot }>` — remove from archive.

### `src/lib/config/mcp-servers.ts`

- `readUserScopeMcpServers(home?): Promise<Record<string, McpServer>>` — MCP servers from `~/.claude.json`.
- `readProjectScopeMcpServers(projectPath): Promise<Record<string, McpServer>>` — MCP servers from `.mcp.json`.

### `src/lib/config/mcp-mutations.ts`

- `mutateUserMcpServers(apply, expected, homeDir?): Promise<MutationResult>` — **the only path by which Boopervisor touches ~/.claude.json**: read-modify-write solely the `mcpServers` key, leaving all other keys byte-identical. `apply` is a pure function copying its argument at each mutation level.
- `archiveMcpServer(serverName, scope, expected, homeDir?): Promise<MutationResult>` — record a server archived in boopervisor.json.
- `unarchiveMcpServer(serverName, scope, expected, homeDir?): Promise<MutationResult>` — remove from archive.

### `src/components/items/master-detail.tsx`

- `interface MasterDetailProps` — `{ items, selectedId, onSelect, detailContent, masterLabel?, className?, showArchived? }`.
- `MasterDetail` — reusable master-detail layout (list left, detail right). Items can be marked `isArchived` or `isDisabled`; archived ones filter out unless `showArchived={true}`.

### Disabling mechanisms (settings-based, not file-based)

- **User-scope MCP servers**: Claude Code disables via `deniedMcpServers` setting (array of objects, each with one key: `serverName`, `serverCommand`, or `serverUrl`). Read via `resolveEffectiveSettings()`, write via `mutateSetting()`.
- **Project-scope MCP servers** (`.mcp.json`): Claude Code disables via `disabledMcpjsonServers` (array of server names as they appear in `.mcp.json`) or `enabledMcpjsonServers` (array of approved names). Read and write via settings resolution and `mutateSetting()`.
- **Skills**: Disable via `skillOverrides` setting (object mapping skill names to override config).
- **Plugins**: Disable via `enabledPlugins` setting (array of plugin IDs).
  All merges by precedence: a server denied at managed scope cannot be re-enabled from user scope. Tickets 09/10 read both families (enabled/disabled keys) to determine if a server's _disabled_ link will actually work, and show grayed-out or missing controls where precedence forbids a change.
