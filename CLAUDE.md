@AGENTS.md

## Agent skills

### Output locations

Skills that write files into this repo use these directories, not the ones their own
instructions assume. The same values are the `env` block of `.claude/settings.json`
(project scope), so `echo "$ADVISOR_PLANS_DIR"` prints the one in force, and a PreToolUse
hook refuses a write into a retired default and names the replacement.

| What                               | Variable            | Directory              | Skill's own default    |
| ---------------------------------- | ------------------- | ---------------------- | ---------------------- |
| Advisor plans (`/improve`)         | `ADVISOR_PLANS_DIR` | `plans/`               | `plans/`               |
| Issues and specs (local tracker)   | `ISSUES_DIR`        | `.scratch/`            | `.scratch/`            |
| ADRs                               | `ADR_DIR`           | `docs/adr/`            | `docs/adr/`            |
| Research notes (`/research`)       | `RESEARCH_DIR`      | `docs/research/`       | none                   |
| Plan pages (`/plan-pages`)         | `PLANS_DIR`         | `artifacts/plans/`     | `artifacts/plans/`     |
| Diagrams (`/diagram-plans`)        | `DIAGRAMS_DIR`      | `artifacts/diagrams/`  | `artifacts/diagrams/`  |
| Decision pages (`/decision-pages`) | `DECISIONS_DIR`     | `artifacts/decisions/` | `artifacts/decisions/` |

`CONTEXT.md` stays at the repo root. To relocate a row: change it here and in the `env`
block together (a test checks they agree), then `git mv` the old directory to the new one.

### Issue tracker

Local markdown under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` at the root, ADRs in `docs/adr/`. See `docs/agents/domain.md`.
