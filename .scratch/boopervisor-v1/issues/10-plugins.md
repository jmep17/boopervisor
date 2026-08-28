# 10: `/plugins`

**What to build:** `/plugins` lists installed plugins and the marketplaces they came from, in the same master-detail shape as `/mcp` and `/skills`. Selecting a plugin shows its `plugin.json` read-only with a path to open it elsewhere. Each plugin is enabled, disabled or archived, disabling through Claude Code's own mechanism for plugins and archival through the store built in ticket 08.

**Blocked by:** 08 (`/mcp` master-detail with item state).

**Status:** ready-for-agent

- [ ] Installed plugins are listed for the selected scope, with the marketplace each came from.
- [ ] Selecting a plugin shows its `plugin.json` read-only, with its path.
- [ ] `plugin.json` is never written by Boopervisor.
- [ ] A plugin can be moved between enabled, disabled and archived, and the state survives a reload.
- [ ] Archiving moves no files.
