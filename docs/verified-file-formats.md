# Verified file formats

Boopervisor reads and writes files Claude Code owns, so several of its assumptions about
those files are load-bearing. This page records which have been checked against the
published documentation, which rest only on what happens to be on one machine, and which
turned out to be wrong.

Checked 2026-08-28 against the docs listed in `settings-catalog.md`. Where the answer comes
from this machine rather than the documentation, it says so: corroboration is not a
specification, and a layout that happens to hold here may not hold everywhere.

## Where a plugin keeps its manifest

`.claude-plugin/plugin.json`, at the plugin's root — and only `plugin.json` belongs in that
directory. The plugins guide is explicit that `commands/`, `agents/`, `skills/` and `hooks/`
go at the plugin root instead, calling the opposite a common mistake
([plugins](https://code.claude.com/docs/en/plugins)).

Two consequences the interface has to respect:

- A manifest at the plugin's root is not documented anywhere. Boopervisor still falls back to
  it, because reading a file Claude Code ignores is a smaller error than showing nothing, but
  the detail panel names the file it actually read rather than the one it expected.
- The manifest is **optional** — "optional if components use default locations". A plugin
  with no `plugin.json` is a working plugin, not a broken one, and is listed as such.

`~/.claude/plugins/installed_plugins.json` is not documented. On this machine it holds
`{ version: 2, plugins: { "<name>@<marketplace>": [{ scope, installPath, version,
installedAt, lastUpdated, gitCommitSha }] } }`, one array per plugin id, every entry so far
with `scope: "user"`. Boopervisor reads the first installation and keeps its `scope` only to
report where the plugin came from — corroboration, not documentation.

## `SKILL.md` frontmatter

Personal skills live at `~/.claude/skills/<skill-name>/SKILL.md` and project skills at
`.claude/skills/<skill-name>/SKILL.md` ([skills](https://code.claude.com/docs/en/skills)).

**Every frontmatter field is optional**; only `description` is recommended. So a skill with
no `name` is perfectly valid, and the skill is named by its directory. Boopervisor lists such
a skill under its directory name rather than dropping it, which is what it used to do.

The documented examples all use plain `key: value`. Block scalars are not documented — but 2
of the 40 skills in `~/.claude/skills/` on this machine write their description as a folded
block (`description: >`), and a parser that takes `>` literally shows the description as
`">"`. The parser therefore handles `>`, `|`, `>-`, `|-` and quoted values. This one rests on
real files, not on the docs.

## The settings keys that disable an item

| Key                      | Shape                                                                                 | What disables an item            |
| :----------------------- | :------------------------------------------------------------------------------------ | :------------------------------- |
| `skillOverrides`         | object, skill name to one of `"on"`, `"name-only"`, `"user-invocable-only"`, `"off"`  | `"off"` only                     |
| `enabledPlugins`         | object, `plugin-name@marketplace-name` to a Boolean                                   | `false`                          |
| `deniedMcpServers`       | array of objects, each with exactly one of `serverName`, `serverCommand`, `serverUrl` | the server matching an entry     |
| `disabledMcpjsonServers` | array of strings, server names as they appear in `.mcp.json`                          | being listed                     |
| `enabledMcpjsonServers`  | array of strings, same                                                                | not being listed, until approved |

Sources: [settings-reference](https://code.claude.com/docs/en/settings-reference) for each
key's type (also extracted verbatim into `src/lib/catalog/settings.data.json`), and
[skills#override-skill-visibility-from-settings](https://code.claude.com/docs/en/skills#override-skill-visibility-from-settings)
for the four `skillOverrides` states.

Three details that change behaviour:

- `"name-only"` and `"user-invocable-only"` narrow how a skill is offered; neither disables
  it. A skill absent from `skillOverrides` is treated as `"on"`.
- **Plugin skills are not affected by `skillOverrides` at all** — they are managed as
  plugins. Boopervisor's `/skills` lists only `~/.claude/skills` and a project's
  `.claude/skills`, so this does not currently bite, but a skills-directory plugin (one
  created by `claude plugin init`, which lives in `~/.claude/skills/<name>/` with its own
  `.claude-plugin/plugin.json`) would sit in that directory and not answer to this key.
- `deniedMcpServers` entries may key on `serverCommand` or `serverUrl` as well as
  `serverName`. Boopervisor writes `serverName` and recognises a server denied by name; a
  server denied by command or URL is not yet recognised as disabled.

## Where a project's MCP servers live

`.mcp.json` at the project root holds the project-scope servers Boopervisor already read
(documented, [mcp#project-scope](https://code.claude.com/docs/en/mcp)).

Local scope — the default `claude mcp add` writes to — lives at `projects[<path>].mcpServers`
in `~/.claude.json` (documented,
[mcp](https://code.claude.com/docs/en/mcp)):

> Local scope is the default. A local-scoped server loads only in the project where you
> added it and stays private to you. Claude Code stores it in `~/.claude.json` under that
> project's path, so the same server won't appear in your other projects.

Claude Code's own record of a `.mcp.json` server's approval — `projects[<path>].
enabledMcpjsonServers` and `disabledMcpjsonServers` — sits in that same project entry.
Undocumented; observed on one machine only.

**Step 1 spike answers**, checked 2026-09-01:

- Q1 (does `deniedMcpServers` cover a server regardless of where it is defined?): **Yes.**
  [settings-reference](https://code.claude.com/docs/en/settings-reference) describes it as
  "Block specific MCP servers by URL, command, or name" with no restriction to a particular
  file — it applies to any MCP server regardless of source. So a local-scope server is denied
  the same way a user-scope one is, and this plan gives local servers the same state controls.
- Q2 (do `enabledMcpjsonServers` / `disabledMcpjsonServers` apply only to `.mcp.json`
  servers?): **Yes.** The same page describes both as approving or rejecting "specific
  servers from a project's `.mcp.json`" — they are scoped to that file, not to servers in
  general.
- Bonus, from [mcp#project-server-approvals-and-workspace-trust](https://code.claude.com/docs/en/mcp#project-server-approvals-and-workspace-trust):
  an unapproved `.mcp.json` server in an untrusted workspace shows as
  `⏸ Pending approval (run claude to approve)` rather than connected — a third state
  alongside enabled and disabled that the docs name explicitly for that case. Whether the
  same "pending, not disabled" reading holds for a **trusted** workspace's unlisted server is
  not stated, which is why the bullet below stays open.

## The hooks key

Three nesting levels, not two. `hooks` is an object keyed by event; each value is an array of
`{ matcher, hooks }` groups; each group's `hooks` array holds actions with their own `type`
([hooks](https://code.claude.com/docs/en/hooks)). `matcher` is optional and only meaningful on
tool-related events — absent or `"*"` means every occurrence.

A `command` action carries `command` (string) and optionally `timeout` (seconds) and `async`
(Boolean). The other documented types — `prompt`, `agent`, `http`, `mcp_tool` — carry their
own fields (`prompt`/`model`; `url`/`headers`/`allowedEnvVars`/`timeout`; `server`/`tool`/
`input`). Boopervisor edits `command` hooks as a form and preserves every other type's fields
untouched, shown read-only.

A flat `{ matcher, command }` entry — the shape this file used to assume — is not valid and is
refused rather than silently accepted. A `hooks` value the parser cannot read is never
replaced with an empty one: the editor falls back to showing the value as JSON.

## Custom output styles

`~/.claude/output-styles` at user level, `.claude/output-styles` at project level, one
Markdown file per style. **The file name becomes the style name unless the frontmatter sets
`name`** ([output-styles](https://code.claude.com/docs/en/output-styles)), and it is the name
that `outputStyle` is set to — so Boopervisor reads the frontmatter and falls back to the
file name. The five built-in styles (`Default`, `Proactive`, `Concise`, `Explanatory`,
`Learning`) are not files and are offered alongside whatever is on disk.

## `managed-settings.json`

| Platform      | Path                                                            |
| :------------ | :-------------------------------------------------------------- |
| macOS         | `/Library/Application Support/ClaudeCode/managed-settings.json` |
| Linux and WSL | `/etc/claude-code/managed-settings.json`                        |
| Windows       | `C:\Program Files\ClaudeCode\managed-settings.json`             |

From [managed-settings](https://code.claude.com/docs/en/managed-settings), which also says
plainly that Claude Code **does not** read the legacy Windows path
`C:\ProgramData\ClaudeCode\managed-settings.json`.

## What this changed

| Assumption                                                                      | Verdict                                                                                                                                                                 |
| :------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plugin manifest at `.claude-plugin/plugin.json`                                 | Confirmed. The root fallback is undocumented and kept only as a courtesy.                                                                                               |
| `SKILL.md` frontmatter needs handling for block scalars                         | Not documented, but true of real files here. Kept.                                                                                                                      |
| `skillOverrides` disables with `"off"` or `"hidden"`                            | **Wrong.** There is no `"hidden"`. The four states are `"on"`, `"name-only"`, `"user-invocable-only"`, `"off"`, and only `"off"` disables. Corrected.                   |
| A skill with no `name` in its frontmatter can be skipped                        | **Wrong.** Every field is optional; the directory names the skill. Corrected.                                                                                           |
| Custom output styles are `~/.claude/output-styles/*.md`, named by file          | Half right. The path is correct; the name comes from frontmatter when it is set. Corrected, and the built-in styles are now offered too.                                |
| Windows managed settings at `C:\ProgramData\ClaudeCode\`                        | **Wrong**, and explicitly so: that is the legacy path Claude Code does not read. Corrected to `C:\Program Files\ClaudeCode\`.                                           |
| `enabledPlugins`, `deniedMcpServers`, `disabled`/`enabledMcpjsonServers` shapes | Confirmed against the reference.                                                                                                                                        |
| `hooks` is a flat list of `{ matcher, command }` per event                      | **Wrong.** Groups carry a `hooks` array of typed actions; a flat entry is refused, and a value the parser cannot read is shown as JSON rather than replaced. Corrected. |

## Still unverified

- Whether a **trusted** workspace's `.mcp.json` server left off both `enabledMcpjsonServers`
  and `disabledMcpjsonServers` is _disabled_ or merely _unapproved until the approval dialog
  is accepted_. The docs confirm a third "pending approval" state exists for an untrusted
  workspace; whether the same applies once trusted is not stated. Boopervisor treats unlisted
  as disabled, which reads the right way in the interface but may not be what Claude Code
  does.
- The exact shape and semantics of `projects[<path>].enabledMcpjsonServers` and
  `disabledMcpjsonServers` in `~/.claude.json` — observed on one machine, not documented.
  Boopervisor reads them for display only and never writes them.
- Whether `installed_plugins.json` ever holds more than one installation for a plugin id, and
  what `version: 2` denotes. Boopervisor takes the first entry.
