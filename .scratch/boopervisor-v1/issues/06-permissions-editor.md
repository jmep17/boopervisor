# 06: Permissions editor

**What to build:** `permissions` gets a purpose-built editor rather than a JSON blob, because it is edited more than almost anything else and a typo silently breaks Claude Code. Rules in `allow`, `ask` and `deny` can be added, edited, reordered and removed, each list shown separately, with the rule syntax validated before the write is accepted.

**Blocked by:** 05 (Remaining typed controls).

**Status:** ready-for-agent

- [x] `allow`, `ask` and `deny` are edited as three lists of rules, not as raw JSON.
- [x] A malformed rule is refused before anything is written, with a message naming the problem.
- [x] Rules can be reordered and the written order matches what is shown.
- [x] The per-scope breakdown shows which scope contributed which rules.
- [x] Writes go through the same validated, backed-up, stale-checked path.
