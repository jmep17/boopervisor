# 02: Scope switcher

**What to build:** A global switcher in the header selects the scope every page is read and written against: the user scope, or a specific project. Projects are listed from the `projects` map in `~/.claude.json`. A project that is not listed can be added with a manual directory picker. Nothing is discovered by scanning the filesystem. The selection survives navigation between routes and is readable by every page and Server Action.

**Blocked by:** 01 (App shell in Geist tokens).

**Status:** ready-for-agent

- [x] The switcher lists the user scope plus every project from the `projects` map in `~/.claude.json`.
- [x] A directory that is not in that map can be selected manually and becomes usable as a scope.
- [x] No code path enumerates directories looking for projects.
- [x] The selection persists across navigation and page reload.
- [x] Reading `~/.claude.json` is server-only and tolerates the file being absent or unparseable without crashing the page.
