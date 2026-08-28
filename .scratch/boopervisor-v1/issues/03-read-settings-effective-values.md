# 03: Read settings and show effective values

**What to build:** `/settings` shows what Claude Code will actually do. For the selected scope it reads the user, project, project-local and managed settings files, merges them by precedence, and for every catalog key shows the effective value together with a per-scope breakdown of which scope set it and which scope won. Keys are grouped by the catalog's topics. Everything is read-only in this ticket. Keys present on disk that the catalog does not describe are surfaced as uncatalogued rather than hidden, and managed settings are marked read-only. The file-format knowledge lives in `src/lib/config/` as pure functions over a directory path, unit-tested against a temporary directory, tests first.

**Blocked by:** 02 (Scope switcher).

**Status:** ready-for-agent

- [ ] Precedence resolves managed over project-local over project over user, with tests covering a key set in several scopes at once.
- [ ] Every settings file may be absent, empty or malformed without breaking the page; the state is reported rather than swallowed.
- [ ] Each key shows its effective value, its winning scope, and the value each scope contributed.
- [ ] Uncatalogued keys found on disk are listed and labelled as such.
- [ ] Managed settings are visibly read-only.
- [ ] `~/.claude.json` is not part of the settings merge.
- [ ] `src/lib/config/` is tested against a temporary directory with no browser involved.
