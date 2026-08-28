# 07: Hooks editor

**What to build:** `hooks` gets a purpose-built editor driven by the hooks catalog: each entry names its event, its matcher and the command it runs, and the events offered are the ones Claude Code actually supports. Hook scripts themselves are not edited here — they are shown read-only with a path so the user can open them elsewhere.

**Blocked by:** 05 (Remaining typed controls).

**Status:** ready-for-agent

- [ ] Hook entries are added, edited and removed per event, with events drawn from the catalog rather than typed by hand.
- [ ] A hook missing a required field is refused before the write.
- [ ] The script a hook points at is shown read-only, with its path, and is never rewritten by Boopervisor.
- [ ] The per-scope breakdown shows which scope contributed which hooks.
- [ ] Writes go through the same validated, backed-up, stale-checked path.
