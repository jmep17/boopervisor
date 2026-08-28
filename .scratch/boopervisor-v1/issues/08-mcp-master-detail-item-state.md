# 08: `/mcp` master-detail with item state

**What to build:** `/mcp` lists the MCP servers for the selected scope, with the list on the left and the server's detail and state controls on the right. User-scope servers come from the `mcpServers` key of `~/.claude.json` and project servers from `.mcp.json`. Because Claude Code writes to `~/.claude.json` constantly, Boopervisor read-modify-writes only the `mcpServers` key and never reserialises the rest of the file. Each server is enabled, disabled or archived: disabling uses Claude Code's own mechanism for MCP servers, and archival is Boopervisor's own state, recorded in Boopervisor's own file, which never moves or alters the server's configuration (ADR 0002). This ticket establishes the archival store that skills and plugins reuse.

**Blocked by:** 04 (Write one setting end to end).

**Status:** ready-for-agent

- [ ] Servers from both user and project scope are listed, and selecting one shows its configuration read-only.
- [ ] A write to `~/.claude.json` changes the `mcpServers` key and leaves project history, session state and onboarding flags byte-identical.
- [ ] A server can be moved between enabled, disabled and archived, and the state survives a reload.
- [ ] Archived servers are held disabled and hidden from the main listing, with a way to see them.
- [ ] Archival is recorded in Boopervisor's own file; no MCP configuration is moved or deleted.
- [ ] Every write is backed up and stale-checked like any other mutation.
