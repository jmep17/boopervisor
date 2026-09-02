# Settings catalog sources

The catalog in `src/lib/catalog/` describes every documented Claude Code setting. Per ADR 0003
it is owned by hand, but it is _populated_ by two extraction scripts run deliberately, not at
build time and never at runtime:

```bash
bun run catalog          # all of the below
bun run catalog:settings # -> src/lib/catalog/settings.data.json
bun run catalog:hooks    # -> src/lib/catalog/hooks.data.json
bun run catalog:env-vars # -> src/lib/catalog/env-vars.data.json
```

The generated JSON is committed. Corrections and interface hints live beside it in
`overrides.ts`, which is written by hand and never regenerated. Every override carries a
`note` explaining why it exists, and `bun test` fails if an override names a key the
reference no longer documents, so a regeneration cannot silently strand one.

## Primary sources

- Settings and precedence: https://code.claude.com/docs/en/settings.md
- Full key reference: https://code.claude.com/docs/en/settings-reference.md
- Managed settings: https://code.claude.com/docs/en/managed-settings.md
- Hooks: https://code.claude.com/docs/en/hooks.md
- Environment variables: https://code.claude.com/docs/en/env-vars.md
- Skills: https://code.claude.com/docs/en/skills.md
- Plugins: https://code.claude.com/docs/en/plugins.md
- MCP: https://code.claude.com/docs/en/mcp.md

## What the extraction found

Extracted 2026-08-28: **217 keys** across 19 topics, every one matched between the reference's
index table and its own section, and every one with a scope.

Scope phrases in the reference map onto files as follows. `Global config` is `~/.claude.json`
and is not part of the settings merge at all.

| Phrase                    | Files                         |
| :------------------------ | :---------------------------- |
| `Any file`                | user, project, local, managed |
| `User, local, or managed` | user, local, managed          |
| `User or managed`         | user, managed                 |
| `Managed`                 | managed                       |
| `Global config`           | `~/.claude.json`              |

Precedence, highest to lowest: managed → command-line `--settings` (not persisted, out of
scope) → `.claude/settings.local.json` → `.claude/settings.json` → `~/.claude/settings.json`.

## Answers to the questions this pass had to close

**Enumerated values.** 27 keys have a genuinely closed set and get a strict picker. Four more looked
enumerated to the extractor but are not, because the reference gives examples in prose rather
than a closed set: `language` ("any language name ... Claude Code doesn't validate it"),
`advisorModel` and `model` (an alias _or_ a full model ID), and `outputStyle` (a built-in or a
custom style, which lives on disk). Those get a free picker. `theme` is a closed set of seven
plus two open forms, `custom:<slug>` and `custom:<plugin-name>:<slug>`. `theme`'s seven names
are suggestions in the catalog, not `enumValues`, because the validator treats `enumValues`
as closed and the custom forms must pass.

- `effortLevel`: `low`, `medium`, `high`, `xhigh`
- `permissions.defaultMode`: `default`, `acceptEdits`, `plan`, `auto`, `dontAsk`,
  `bypassPermissions`, `manual`
- Model keys: aliases `fable`, `opus`, `sonnet`, `haiku` resolve to that family's current
  default; a full ID such as `claude-opus-5` is equally valid

**Keys that are one fixed string or absent**, with no `false` form:
`disableAutoMode`, `disableDeepLinkRegistration` and `permissions.disableBypassPermissionsMode`
take the string `"disable"`; `browserExternalPageTools` takes `"disabled"`, with the desktop app
also accepting `"disable"`. These render as a switch that writes the literal or removes the key.

**Hook event names**: 31 events, extracted to `hooks.data.json` — SessionStart, Setup,
InstructionsLoaded, UserPromptSubmit, UserPromptExpansion, MessageDisplay, PreToolUse,
PermissionRequest, PostToolUse, PostToolUseFailure, PostToolBatch, PermissionDenied,
Notification, SubagentStart, SubagentStop, TaskCreated, TaskCompleted, Stop, StopFailure,
TeammateIdle, ConfigChange, CwdChanged, DirectoryAdded, FileChanged, WorktreeCreate,
WorktreeRemove, PreCompact, PostCompact, SessionEnd, Elicitation, ElicitationResult.

Environment variables, extracted 2026-09-02: **352 variables** from the one table under
"Variables", 6 of them read by presence only. The table has no per-row anchors, so every
entry cites the section.

**Permission rule syntax**: `Tool` or `Tool(specifier)` — e.g. `Bash`, `Bash(npm run *)`,
`Read(./.env)`, `WebFetch(domain:example.com)`. Evaluation is `deny`, then `ask`, then `allow`,
and the **first match wins regardless of specificity**. The interface must show rules in that
evaluation order, because a broad `allow` is not overridden by a narrow `deny` written later —
it is the list order that decides.

**Sandbox path syntax**, which is _not_ the same dialect as permission rules and is the sharpest
edge found in this pass:

- `/` is an absolute path; `~/` is home-relative; `./` or no prefix is relative to the project
  root for project settings and to `~/.claude` for user settings. `//path` also means absolute.
- Permission rules invert this: there, `//path` is absolute and `/path` is project-relative.
  The same string means different things in the two places, so the interface must never share
  a path control between them.
- A trailing `/` and a trailing `/**` are both stripped.
- Wildcards work in `denyRead` and `allowRead` everywhere. In `allowWrite` and `denyWrite` they
  work on macOS only: on Linux and WSL2 an entry containing `*`, `?` or `[` is **skipped
  entirely and has no effect**. `Edit` permission rules are folded into these lists, so the
  same trap applies to them. A wildcard in a write path is worth a warning in the interface.

**`pluginConfigs`**: still unresolved. The per-plugin shape is plugin-defined and undocumented,
so it stays a validated JSON editor. Same for `statusLine`, `modelPicker` and `autoMode`.

**`strictPluginOnlyCustomization`**: a union — `true` locks all four kinds of customization, or
an array naming them from `"skills"`, `"agents"`, `"hooks"`, `"mcp"`. The reference documents
each array member as its own key; those four are marked virtual in the catalog and hidden,
since they are not settable on their own.
