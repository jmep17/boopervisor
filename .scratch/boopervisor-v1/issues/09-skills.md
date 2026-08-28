# 09: `/skills`

**What to build:** `/skills` lists the skills available in the selected scope in the same master-detail shape as `/mcp`. Selecting a skill shows its metadata read-only, with the path to its `SKILL.md` so the user can open it elsewhere — Boopervisor manages state, not content. Each skill is enabled, disabled or archived, disabling through Claude Code's own mechanism for skills, and archival through the store built in ticket 08.

**Blocked by:** 08 (`/mcp` master-detail with item state).

**Status:** ready-for-agent

- [x] Skills for the selected scope are listed, and selecting one shows its metadata and its path.
- [x] `SKILL.md` is never written by Boopervisor.
- [x] A skill can be moved between enabled, disabled and archived, and the state survives a reload.
- [x] Disabling uses Claude Code's own mechanism for skills, not archival.
- [x] Archiving moves no files.
