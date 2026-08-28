# 11: History and restore

**What to build:** `/history` lists every mutation Boopervisor has made, newest first, each with a diff of what changed in the file. Any backup can be restored in one action. A restore is itself a mutation: it is backed up before it writes, it is stale-checked, and it appears in the history list like any other change.

**Blocked by:** 04 (Write one setting end to end).

**Status:** ready-for-agent

- [x] Every mutation from settings and from item state appears in the list with its file, scope and timestamp.
- [x] Each entry shows a readable diff of the change.
- [x] Restoring a backup returns the file to those contents in one action.
- [x] A restore writes its own backup first and is refused as a stale write if the file changed since it was read.
- [x] The restore appears in the history list afterwards.
- [x] Pruning to the most recent 50 backups leaves the history list coherent rather than showing entries that cannot be restored.
