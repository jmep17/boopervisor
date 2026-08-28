# 04: Write one setting end to end

**What to build:** A boolean or string setting can be changed from `/settings` and the change lands on disk safely. This ticket proves the whole mutation path on the simplest controls: the value is validated against the catalog and an invalid write is refused; a backup is written to `~/.claude/.boopervisor-backups/` as `<file>.<timestamp>.json` before the file is touched, and the backups are pruned to the most recent 50; the file's mtime and hash are checked against what was read and a stale write is refused rather than overwriting a change Boopervisor never saw; unknown keys already in the file are preserved untouched; and the mutation is recorded so `/history` can later render it. The mutation goes through a Server Action, so pending and error state come from the form. Editing targets the scope selected in the header, and the per-scope breakdown makes it visible when a higher-precedence scope will still override what was just typed.

**Blocked by:** 03 (Read settings and show effective values).

**Status:** ready-for-agent

- [ ] Changing a boolean or string setting writes it to the selected scope's file and the effective value updates.
- [ ] A backup exists after every mutation, named `<file>.<timestamp>.json`, and only the 50 most recent survive.
- [ ] A file modified on disk between read and write is refused as a stale write, with a message saying so.
- [ ] A value the catalog rejects is refused before anything is written.
- [ ] Unknown keys and formatting elsewhere in the file survive the write.
- [ ] Every mutation is appended to a log holding enough to render a diff and to restore.
- [ ] The interface says when the edited scope is not the winning scope.
