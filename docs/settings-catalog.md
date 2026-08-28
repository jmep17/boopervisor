# Settings catalog sources

The catalog in `src/lib/catalog/` is hand-maintained (see ADR 0003). This file records where
each entry came from, so a future update can be diffed against the same sources.

## Primary sources

- Settings and precedence: https://code.claude.com/docs/en/settings.md
- Full key reference: https://code.claude.com/docs/en/settings-reference.md
- Managed settings: https://code.claude.com/docs/en/managed-settings.md
- Skills: https://code.claude.com/docs/en/skills.md
- Plugins: https://code.claude.com/docs/en/plugins.md
- Creating plugins: https://code.claude.com/docs/en/create-plugins.md
- MCP: https://code.claude.com/docs/en/mcp.md

## Precedence, highest to lowest

1. Managed settings (`managed-settings.json`, MDM) — not editable
2. Command-line flags (`claude --settings`) — not persisted, out of scope
3. Project-local (`.claude/settings.local.json`)
4. Project (`.claude/settings.json`)
5. User (`~/.claude/settings.json`)

## Entries

Not yet populated. The catalog needs one research pass over the settings reference before
implementation begins. Open questions that pass must answer:

- The exact enumerated values for `model`, `availableModels` and `effortLevel`
- The complete list of valid hook event names
- The schema of `pluginConfigs`
- The syntax accepted by `permissions.allow` / `ask` / `deny` rules
- The glob dialect used by `sandbox.filesystem.*` and `sandbox.network.*`, including negation
