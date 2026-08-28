# Archival is Boopervisor's own state, not a change to Claude Code's files

Claude Code has no archived state for skills, plugins or MCP servers. It has enabled and
disabled, expressed differently per item type: `skillOverrides` for skills, `enabledPlugins`
and `pluginConfigs` for plugins, and the `enabledMcpServers` / `disabledMcpServers` family
for MCP servers. Archival is a concept we are adding.

Boopervisor records archived items in its own file, `~/.claude/boopervisor.json`, and applies
Claude Code's native disable underneath. An archived item is therefore disabled as far as
Claude Code is concerned, and hidden from the main listing as far as the interface is
concerned. Nothing else changes.

We rejected the alternative of making archival physical — renaming a skill directory out of
Claude Code's scan path, or cutting an MCP server entry out of `~/.claude.json` and holding
it in our own file. That version reads as tidier and is materially more dangerous: it makes
Boopervisor the only thing that can restore the user's configuration, and for MCP servers it
means the definition of a live server exists solely inside our sidecar file. Uninstall
Boopervisor at that point and the configuration is gone. Keeping archival additive means
Claude Code's own files are always complete and always valid, with or without us.
