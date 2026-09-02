# Plan 025: Every skill's output location is declared once, and a hook refuses the retired defaults

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` (or wherever the user's `ADVISOR_PLANS_DIR` row says the index
> lives) unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat eff98d2..HEAD -- AGENTS.md CLAUDE.md .claude/settings.json scripts/ docs/agents/`
> If any of those files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (`plans/` is deliberately not in
> the list: this plan and its index row were committed after the original planning commit, so
> `plans/` always differs.)
>
> Run every command below in bash (the `Bash` tool; Git Bash on Windows).
> Backticks inside single quotes are literal there; do not rewrite them for
> another shell.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `eff98d2`, 2026-09-02 (originally written at `547101c` and
  reconciled after plans 018–024 landed; see "Review log" at the end)

## Portability contract

The result of this plan is a set of **committed repository files** and nothing else. It
must behave the same on every machine that clones the repo — the author's, a work machine
with a different Claude Code configuration, a teammate's, CI — and it must never depend on
what is installed in a particular `~/.claude/` or `~/.agents/`. Concretely:

- The only thing the mechanism _requires_ is that Claude Code reads the project's
  `.claude/settings.json` and `CLAUDE.md`, which it does by default in every session type.
- The hook is an **enforcement layer on top of a declaration**, not the declaration. If a
  machine cannot run it — no `bun` on `PATH`, hooks disabled by a managed policy, a
  `--bare` session — the `CLAUDE.md` table still tells every model where to write, and
  the repo is in exactly the state it would be in without this plan. Degrading to that
  state must always be silent, never an error on every write.
- Nothing in the committed files may name a machine-specific path (no `/Users/…`, no
  `/opt/homebrew/…`), a particular skill install location, or a particular plugin.
- The plan's verification commands must themselves run on any machine with `git`, `bun`
  and a POSIX shell. A check that reads the executing machine's own configuration is
  informational (Step 0), never a gate.

Facts observed on the author's machine during review are evidence for the design and live
in the Review log only; do not treat them as preconditions.

## The values are the user's, not this plan's

This plan installs the _mechanism_ and takes no position on where anything should live.
Every row below starts as the directory the skill uses today, so landing the plan moves
nothing and changes no behaviour until the user edits a row. The table is the single place
to change a value; every step reads from it.

| What                               | Variable            | Directory (today's)   | Directory the skill assumes |
| ---------------------------------- | ------------------- | --------------------- | --------------------------- |
| Advisor plans (`/improve`)         | `ADVISOR_PLANS_DIR` | `plans`               | `plans`                     |
| Issues and specs (local tracker)   | `ISSUES_DIR`        | `.scratch`            | `.scratch`                  |
| ADRs                               | `ADR_DIR`           | `docs/adr`            | `docs/adr`                  |
| Research notes (`/research`)       | `RESEARCH_DIR`      | `docs/research`       | none ("somewhere sensible") |
| Plan pages (`/plan-pages`)         | `PLANS_DIR`         | `artifacts/plans`     | `artifacts/plans`           |
| Diagrams (`/diagram-plans`)        | `DIAGRAMS_DIR`      | `artifacts/diagrams`  | `artifacts/diagrams`        |
| Decision pages (`/decision-pages`) | `DECISIONS_DIR`     | `artifacts/decisions` | `artifacts/decisions`       |

`RESEARCH_DIR` is the one row with no existing default; `docs/research` is a placeholder
the user may change like any other. If the user has already given you different values,
put them in this table before Step 1; Step 6 then moves any existing files for you.

Rules the values must obey (the first is enforced by a test; the rest are couplings in the
user's own `second-brain` plugins, which read `PLANS_DIR`, `DIAGRAMS_DIR` and
`DECISIONS_DIR`, and which may or may not be installed on a given machine):

- **No row's directory may equal another row's "Directory the skill assumes"** once that
  other row has been relocated. Otherwise the hook refuses the write that the second row
  allows (e.g. `ADVISOR_PLANS_DIR=docs/plans` together with `PLANS_DIR=plans`).
- `ISSUES_DIR`: the `diagrams` plugin's `ready-feedback-nudge.sh` hook hardcodes
  `.scratch/artifact-feedback/issues`; moving `.scratch/` silently disables the artifact
  feedback queue until that script is changed.
- `ADVISOR_PLANS_DIR`, `ISSUES_DIR`: the same plugin's `plan-artifact-nudge.sh` fires only
  for markdown written under a path segment named `plans`, `.scratch`, `spec(s)` or
  `ticket(s)` — `docs/plans/` still matches, `advisor-plans/` does not.
- `PLANS_DIR`, `DIAGRAMS_DIR`, `DECISIONS_DIR`: the plugins' `diagram-open` offers the
  served review page only for files under `<repo>/artifacts/`; a directory outside
  `artifacts/` still works but falls back to opening the raw file.
- The variable names `PLANS_DIR`, `DIAGRAMS_DIR`, `DECISIONS_DIR` are the plugins' own and
  are generic; a different tool on another machine could read the same names. If that
  ever happens, the fix is on the plugin side (a namespaced name), not in this repo.

Deliberately **not** overridable: `CONTEXT.md` at the repo root. The engineering skills
that use it hardcode that path, `/improve` globs for it there, and Matt Pocock's own
supported way to relocate it (a root `CONTEXT-MAP.md` pointing at per-context files) is
built for monorepos. Leave it.

How a later change works, so the user knows what they are buying: edit the row in
`CLAUDE.md`, edit the matching `env` value, `git mv` the old directory to the new one. The
test from Step 4 fails until the two edits agree, and the hook refuses a write into the old
directory and names the new one.

## Why this matters

Skills from three sources write files into this repo, and each has its own hardcoded home:
shadcn's `improve` writes to `plans/` (its Hard Rule 1 says so), Matt Pocock's engineering
skills write to `.scratch/`, `docs/adr/` and `CONTEXT.md`, and the user's `second-brain`
plugins write to `artifacts/*` (those already read `PLANS_DIR`, `DIAGRAMS_DIR` and
`DECISIONS_DIR` from the environment). Nothing records these choices in one place, so moving
one today means editing prose inside a third-party `SKILL.md` in whatever skills directory
a given machine uses, which the next skills update overwrites — and doing it again on the
next machine.

After this plan, the repo declares every location once, in two forms that a test keeps in
agreement: a table in `CLAUDE.md` (what every model reads on every turn) and an `env` block
in the project-scope `.claude/settings.json` (what hooks, the `second-brain` plugins, and
`echo "$ADVISOR_PLANS_DIR"` read). A `PreToolUse` hook refuses a `Write` or `Edit` into a
retired default directory and tells the model where to write instead — so a skill whose own
instructions still say `plans/` is corrected on its first attempt, not silently redirected.
No third-party skill is modified, so the override survives skill updates and travels with
the clone.

## Current state

Files this plan touches or depends on, as they are at `eff98d2`:

- `CLAUDE.md` — exactly one line, `@AGENTS.md`, which makes Claude Code read `AGENTS.md`
  inline. **This is the file that gets the new block.** Reason: Matt Pocock's
  `setup-matt-pocock-skills` skill edits `CLAUDE.md` whenever it exists ("If `CLAUDE.md`
  exists, edit it. Else if `AGENTS.md` exists, edit it.") and updates an existing
  `## Agent skills` block in place — so a block in `CLAUDE.md` is found and maintained by
  that skill, while a block in `AGENTS.md` would get a duplicate appended to `CLAUDE.md`.
- `AGENTS.md` — contains the repo's `# Design` instructions followed by the Next.js block,
  wrapped in the marker lines `<!-- BEGIN:nextjs-agent-rules -->` and
  `<!-- END:nextjs-agent-rules -->`.
  `next dev` maintains it (`writeAgentFiles` in
  `node_modules/next/dist/server/lib/generate-agent-files.js`): while `AGENTS.md` hosts the
  marked block, `next dev` upserts `AGENTS.md` only and never touches `CLAUDE.md`. **This
  plan does not modify `AGENTS.md` at all.**
- `.claude/` in the repo — no `settings.json` and no `settings.local.json`. It holds
  `scheduled_tasks.lock` and `worktrees/` (executor worktrees, git-ignored via
  `.git/info/exclude`). `.claude/settings.json` is **not** git-ignored
  (`git check-ignore .claude/settings.json` prints nothing), so it can be committed.
  There is no `.claude/skills/`, `.claude/commands/` or `.claude/agents/` in the repo.
- `plans/` — `README.md` (the index) plus plan files `001`–`011`, `013`–`025` (there is
  no `012`). All are advisor output from shadcn's `improve`; plans 018–024 are already
  DONE, leaving this file as the only TODO.
- `.scratch/boopervisor-v1/` — `AGENT-BRIEF.md` and `issues/01-…11-….md`: Matt Pocock's
  `to-tickets` local tracker output. `docs/adr/0001–0003`, `CONTEXT.md` at the root.
- `artifacts/plans/2026-08-28-boopervisor-v1.html` — `second-brain` `plan-pages` output.
- `docs/agents/` — does not exist. `docs/` holds `adr/`, `design-system.md`, `PLAN.md`,
  `settings-catalog.md`, `verified-file-formats.md`.
- `scripts/` — `extract-hooks-reference.ts`, `extract-settings-reference.ts` and
  `extract-env-vars-reference.ts`: bun scripts
  run with `bun run scripts/<name>.ts`. `tsconfig.json` includes `**/*.ts`, so anything
  added here is typechecked; `eslint.config.mjs` ignores only `.next/**`, `out/**`,
  `build/**`, `next-env.d.ts` and `.claude/worktrees/**`, so it is linted too.
  `@types/bun` is a devDependency, so `import.meta.main` typechecks.
- Tests live next to the code as `*.test.ts` and run with `bun test`. `bunfig.toml`
  preloads `tests/register-dom.ts` and `tests/setup.ts` for every test file (harmless here).
  **Baseline at `eff98d2`: `bun test` → `477 pass, 0 fail` across 54 files in about 3 s.**
  It does not pick up anything under `.claude/worktrees/**`.
- Pre-commit (`.husky/pre-commit`) runs `bunx lint-staged` (prettier on every staged file,
  `.lintstagedrc` is `{"*": "prettier --ignore-unknown --write"}`; `.prettierrc` has
  `printWidth: 80`, `proseWrap` default so markdown prose is not reflowed), then
  `bun run typecheck`, then `bun test`. Let prettier reformat what it stages.
- `package.json` pins `"packageManager": "bun@1.3.14"`; every developer of this repo has
  `bun`, which is why the hook is a `bun` script and not a `node` one.

How the three skill families locate their output (read-only reference, quoted from the
skills' own `SKILL.md` files as installed on the author's machine on 2026-09-01; the
install location varies by machine — `~/.agents/skills/`, `~/.claude/skills/`, a project
`.claude/skills/`, or a plugin — and the mechanism does not care which):

- `improve/SKILL.md` — "The ONLY files you may create or modify live under `plans/` in
  the repo root — or under `advisor-plans/` when `plans/` already exists for an unrelated
  purpose". The skill has no configuration hook of any kind.
- `to-tickets/SKILL.md` — "**Local files** → write one file per ticket under
  `.scratch/<feature-slug>/issues/<NN>-<slug>.md`".
- `setup-matt-pocock-skills/SKILL.md` — Matt Pocock's own configuration mechanism. It
  writes an `## Agent skills` block with sub-headings `### Issue tracker`,
  `### Triage labels` (only when the `triage` skill is installed) and `### Domain docs`,
  each pointing at a file under `docs/agents/`, and "If an `## Agent skills` block already
  exists in the chosen file, update its contents in-place rather than appending a
  duplicate." His other skills (`code-review`, `to-tickets`, `to-spec`, `triage`,
  `wayfinder`, `domain-modeling`) read those files from the repo. Steps 3b and 3c are its
  seed templates (`issue-tracker-local.md`, `domain.md`) with this repo's values filled in.
- `second-brain` `plan-pages/SKILL.md` — "directory: `$PLANS_DIR` if set (absolute, or
  relative to the project root), else `artifacts/plans/`". `diagram-plans` and
  `decision-pages` do the same with `DIAGRAMS_DIR` and `DECISIONS_DIR`. This is the
  convention the `env` block in Step 1 extends.
- `research/SKILL.md` — "Save it where the repo already keeps such notes; match the
  existing convention, and if there is none, put it somewhere sensible". No default,
  hence `RESEARCH_DIR` is declared but not guarded.

Claude Code facts this plan relies on, each checked against the docs on 2026-09-01
(quotes are verbatim; re-check the URL if anything below surprises you):

- **Skill precedence** (https://code.claude.com/docs/en/skills, "When skills share the
  same name"): "Across levels, enterprise overrides personal, and personal overrides
  project." A project-local patched copy of `improve` in `.claude/skills/improve/` would
  be shadowed on any machine that has a personal copy; that is why this plan does not try.
- **Settings precedence** (https://code.claude.com/docs/en/settings): managed settings
  sit above project `.claude/settings.json`, which sits above user `~/.claude/settings.json`,
  and "An `env` block inside a settings file is an ordinary key and follows the levels
  above". So the repo's `*_DIR` values win over a user-level value of the same name
  (intended: the repo declares its own layout) and lose to a managed one.
- **Hooks merge, they do not replace** (https://code.claude.com/docs/en/hooks): "Hook
  entries merge across settings levels rather than replacing each other" and "All matching
  hooks run in parallel." Whatever hooks a machine's user settings or plugins define keep
  running alongside Step 5's.
- **Hooks can be switched off above the project** (https://code.claude.com/docs/en/settings-reference):
  `disableAllHooks` ("Any file") turns hooks off; `allowManagedHooksOnly` and
  `strictPluginOnlyCustomization.hooks` (managed) restrict hooks to organisation sources.
  On such a machine Step 5's hook never runs and the `CLAUDE.md` table is the only guard.
- **PreToolUse hooks** (hooks page): exit code 2 "Blocks the tool call", and when the hook
  prints no JSON "stderr is used as the blocking message shown to Claude". Any other
  non-zero exit is a non-blocking error: "the action proceeds, and the transcript shows a
  `<hook name> hook error` notice followed by the first line of stderr". Stdin is JSON with
  `cwd`, `tool_name`, `tool_input` (for `Write` and `Edit`, `tool_input.file_path`). A
  matcher of `Write|Edit` is an exact-name list. The command "is passed to a shell: `sh -c`
  on macOS and Linux, Git Bash on Windows, or PowerShell when Git Bash isn't installed",
  the hook process "inherits the parent environment", and `${CLAUDE_PROJECT_DIR}` is "the
  project root where the session started" and, in a worktree, "stays put".
- **When a hook edit takes effect** (same page): "Direct edits to hooks in settings files
  are normally picked up automatically by the file watcher." So the hook from Step 5 may be
  live in _your own_ session as soon as you save the file. With this plan's values it
  refuses nothing, so you will not notice — but see the STOP condition about your own
  writes.
- **Trust** (https://code.claude.com/docs/en/permissions, "What runs before you trust a
  folder"): hooks in settings files and the `env` block are "Used" both when only a parent
  folder is trusted and in `claude -p`. In an interactive session in a folder never opened
  before, the trust dialog "lists the rules, additional directories, hooks, and helper
  commands the directory's settings would activate". Consequence: anyone who clones this
  repo runs Step 5's hook from their first session, after that one dialog. Say so in the
  PR description.
- **`updatedInput`** (hooks page) is an honoured PreToolUse output field. This plan still
  refuses rather than rewrites, on purpose: a silent rewrite leaves the model believing the
  file is where it asked for it, and every later reference it makes is wrong. A refusal
  with the right path teaches instead.

Conventions to match:

- Comments are full sentences that say why, e.g. `src/lib/skills/read.ts:106-109`:

  ```ts
  /**
   * Read all skills from the user scope: ~/.claude/skills directory.
   * Returns an object mapping skill name to Skill.
   */
  export async function readUserScopeSkills(
  ```

- Tests use `bun:test` with `describe`/`test`/`expect`; model after
  `src/lib/skills/read.test.ts:1-30`.
- Vocabulary from `CONTEXT.md`: `.claude/settings.json` is the **project scope**; call it
  that in comments and docs, not "level" or "tier" (`CONTEXT.md:12` lists those as words
  to avoid).

## Commands you will need

| Purpose     | Command                               | Expected on success            |
| ----------- | ------------------------------------- | ------------------------------ |
| Install     | `bun install`                         | exit 0                         |
| Typecheck   | `bun run typecheck`                   | exit 0, no errors              |
| Lint        | `bun run lint`                        | exit 0                         |
| Guard tests | `bun test scripts/skill-output-guard` | 9 pass, 0 fail                 |
| All tests   | `bun test`                            | 486 pass, 0 fail (477 + 9 new) |

## Scope

**In scope** (the only files you may create or modify):

- `.claude/settings.json` (create)
- `scripts/skill-output-guard.ts` (create)
- `scripts/skill-output-guard.test.ts` (create)
- `CLAUDE.md` (append a block after the existing `@AGENTS.md` line; never remove that line)
- `docs/agents/issue-tracker.md` (create)
- `docs/agents/domain.md` (create)
- Any directory the user renamed in the table (Step 6: `git mv` old to new; with the
  table as written, none)

**Out of scope** (do NOT touch, even though they look related):

- `AGENTS.md` — `next dev` owns it, markers included. This plan never edits it.
- Anything outside this repository: the user's home directory (`~/.claude/`,
  `~/.agents/`, plugin caches), other repositories, skill or plugin sources. Not modifying
  them is the point of this plan.
- `src/**` — no product change. A Boopervisor panel for these settings is a recorded
  direction candidate, not this plan.
- `CONTEXT.md`, `docs/adr/**`, `.scratch/**`, `artifacts/**` — referenced, never edited or
  moved.
- The bodies of plans `001`–`024` — DONE and historical. Never mass-edit them, even if
  the user relocates `plans/`.
- `.claude/settings.local.json` — not created. The override must be committed so it
  travels with every clone.
- `docs/agents/triage-labels.md` and `docs/agents/adhd-writing.md` — not created; see
  Maintenance notes.

## Git workflow

- Branch: `advisor/025-skill-output-locations`
- Commit per step. Message style: sentence-case imperative summary line, no type prefix —
  e.g. `Record that plans 013-017 are merged`.
- The pre-commit hook formats, typechecks and tests. Do not bypass it with `--no-verify`.
- Do NOT push or open a PR unless the operator instructed it. If you do write a PR
  description, state that the change adds a committed `PreToolUse` hook that runs
  `bun run scripts/skill-output-guard.ts` on every `Write`/`Edit` for everyone who opens
  the repo, and that it is a no-op where `bun` is absent or hooks are disabled.

## Steps

### Step 0: Record what this machine's own configuration adds (informational)

`bun -e 'const os = require("node:os"); let s = {}; try { s = require(os.homedir() + "/.claude/settings.json"); } catch {} console.log(JSON.stringify({ dirKeys: Object.keys(s.env ?? {}).filter((k) => k.endsWith("_DIR")), hookEvents: Object.keys(s.hooks ?? {}), disableAllHooks: s.disableAllHooks ?? false }))'`

Copy the output line into your report. Nothing here is a gate: a user-level `*_DIR` value
is overridden by the project scope on purpose, extra hooks merge with Step 5's, and
`disableAllHooks: true` means the hook is dormant on this machine while the `CLAUDE.md`
table still applies. The line exists so a reviewer can explain any surprise later.

### Step 1: Declare the locations in the project scope

Create `.claude/settings.json` with exactly this content (values from the table above):

```json
{
  "env": {
    "ADVISOR_PLANS_DIR": "plans",
    "ISSUES_DIR": ".scratch",
    "ADR_DIR": "docs/adr",
    "RESEARCH_DIR": "docs/research",
    "PLANS_DIR": "artifacts/plans",
    "DIAGRAMS_DIR": "artifacts/diagrams",
    "DECISIONS_DIR": "artifacts/decisions"
  }
}
```

Do not add the `hooks` key yet — Step 5 does, after the script it points at exists. (The
file watcher would otherwise register a hook whose command fails on every `Write`.)

**Verify**: `bun -e 'const s = require("./.claude/settings.json"); console.log(Object.keys(s.env).length, s.env.ADVISOR_PLANS_DIR)'`
→ `7 plans` (`bun -e` resolves `require` relative to the current directory; run it at the
repo root).

### Step 2: Write the guard script

Create `scripts/skill-output-guard.ts`:

```ts
import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

/**
 * A skill output whose default directory this repo may have retired. `variable` is the
 * environment variable, set in the project scope's `.claude/settings.json` `env` block,
 * that names the directory actually in use; `assumed` is the directory the skill's own
 * instructions hardcode. An output with no hardcoded default (research notes) has nothing
 * to refuse, so it is declared in CLAUDE.md only.
 */
export const OUTPUTS = [
  { variable: "ADVISOR_PLANS_DIR", label: "Advisor plans", assumed: "plans" },
  { variable: "ISSUES_DIR", label: "Issues and specs", assumed: ".scratch" },
  { variable: "ADR_DIR", label: "ADRs", assumed: "docs/adr" },
  { variable: "PLANS_DIR", label: "Plan pages", assumed: "artifacts/plans" },
  {
    variable: "DIAGRAMS_DIR",
    label: "Diagrams",
    assumed: "artifacts/diagrams",
  },
  {
    variable: "DECISIONS_DIR",
    label: "Decision pages",
    assumed: "artifacts/decisions",
  },
] as const;

/** `./plans/` and `plans` name the same directory; compare them in one spelling. */
export function trimSlashes(directory: string): string {
  return directory.replace(/^\.\//, "").replace(/\/+$/, "");
}

/**
 * The message to refuse a write with, or null to let it through. A write is refused only
 * when it targets a default directory this repo has moved elsewhere; an output whose
 * variable is unset, or equal to its default, is not policed at all, and a path outside
 * the repo is none of this guard's business. Separators are compared as `/` so the same
 * check holds on Windows, where `relative` returns backslashes.
 */
export function refusal(
  filePath: string,
  cwd: string,
  env: Record<string, string | undefined>
): string | null {
  const target = relative(
    cwd,
    isAbsolute(filePath) ? filePath : resolve(cwd, filePath)
  ).replace(/\\/g, "/");
  if (target.startsWith("..") || isAbsolute(target)) return null;
  for (const output of OUTPUTS) {
    const configured = env[output.variable];
    if (!configured || trimSlashes(configured) === output.assumed) continue;
    if (target === output.assumed || target.startsWith(`${output.assumed}/`)) {
      return (
        `\`${output.assumed}/\` is retired in this repo. ${output.label} live in ` +
        `\`${trimSlashes(configured)}/\` (${output.variable}). Write the file there instead.`
      );
    }
  }
  return null;
}

// Claude Code runs this as a PreToolUse hook for Write and Edit: the tool call arrives as
// JSON on stdin; exit 2 blocks it and shows stderr to the model; exit 0 lets it through.
if (import.meta.main) {
  const input = JSON.parse(readFileSync(0, "utf8")) as {
    cwd?: string;
    tool_input?: { file_path?: unknown };
  };
  const filePath = input.tool_input?.file_path;
  if (typeof filePath === "string") {
    const message = refusal(filePath, input.cwd ?? process.cwd(), process.env);
    if (message) {
      console.error(message);
      process.exit(2);
    }
  }
}
```

**Verify** (three probes; `$PWD` must be the repo root):

1. Refused:
   `echo '{"cwd":"'"$PWD"'","tool_name":"Write","tool_input":{"file_path":"plans/019-probe.md"}}' | ADVISOR_PLANS_DIR=docs/plans bun run scripts/skill-output-guard.ts; echo "exit $?"`
   → stderr contains `` `plans/` is retired in this repo. Advisor plans live in `docs/plans/` (ADVISOR_PLANS_DIR)`` and the last line is `exit 2`
2. Allowed:
   `echo '{"cwd":"'"$PWD"'","tool_name":"Write","tool_input":{"file_path":"docs/plans/019-probe.md"}}' | ADVISOR_PLANS_DIR=docs/plans bun run scripts/skill-output-guard.ts; echo "exit $?"`
   → no output except `exit 0`
3. Not overridden, so not policed:
   `echo '{"cwd":"'"$PWD"'","tool_name":"Write","tool_input":{"file_path":".scratch/x.md"}}' | ISSUES_DIR=.scratch bun run scripts/skill-output-guard.ts; echo "exit $?"`
   → `exit 0`

Then `bun run typecheck` → exit 0 and `bun run lint` → exit 0.

### Step 3: Tell the models — the CLAUDE.md block and Matt Pocock's config files

**3a.** Append the following to `CLAUDE.md`, after the existing `@AGENTS.md` line and a
blank line. The file must still start with `@AGENTS.md`. The table's `Variable` and
`Directory` columns are read by the test in Step 4, so keep the column order
(`What | Variable | Directory | Skill's own default`) and the backticks. The sub-headings
`### Issue tracker` and `### Domain docs` are the exact ones Matt Pocock's setup skill
writes, so that skill recognises this block as its own.

```markdown
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
```

**3b.** Create `docs/agents/issue-tracker.md` (the content Matt Pocock's
`setup-matt-pocock-skills` seed template `issue-tracker-local.md` would write, with the
directory named once and the `triage-labels.md` cross-reference dropped because that file
is not created):

```markdown
# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files under the directory named by
`ISSUES_DIR` in `.claude/settings.json` — `.scratch/` — referred to as `.scratch/` below.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.
```

**3c.** Create `docs/agents/domain.md` (the seed template `domain.md`, single-context
layout only, with this repo's ADR file names):

````markdown
# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root: the glossary. Its terms are used precisely; each entry lists words to avoid.
- **`docs/adr/`** (the directory named by `ADR_DIR` in `.claude/settings.json`): read the ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo:

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-write-config-files-directly.md
│   ├── 0002-archival-is-boopervisors-own-state.md
│   └── 0003-hand-maintained-settings-catalog.md
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0001 (write config files directly), but worth reopening because…_
````

**Verify**:

- `head -1 CLAUDE.md` → `@AGENTS.md` (include still first)
- `grep -c "^## Agent skills" CLAUDE.md` → `1`
- `grep -c '`[A-Z_]*_DIR`' CLAUDE.md` → `7` (one per table row; no other line matches)
- `git diff --quiet eff98d2 -- AGENTS.md && echo unchanged` → `unchanged`
- `test -f docs/agents/issue-tracker.md && test -f docs/agents/domain.md && echo ok` → `ok`

### Step 4: Test the guard, and test that the two declarations agree

Create `scripts/skill-output-guard.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { OUTPUTS, refusal, trimSlashes } from "./skill-output-guard";

const cwd = "/repo";

describe("refusal", () => {
  test("refuses a write into a retired default and names the replacement", () => {
    const message = refusal("plans/019-x.md", cwd, {
      ADVISOR_PLANS_DIR: "docs/plans",
    });
    expect(message).toContain("`docs/plans/`");
    expect(message).toContain("ADVISOR_PLANS_DIR");
  });

  test("allows the configured directory", () => {
    expect(
      refusal("docs/plans/019-x.md", cwd, { ADVISOR_PLANS_DIR: "docs/plans" })
    ).toBeNull();
  });

  test("does not police an output that is not overridden", () => {
    expect(refusal("plans/x.md", cwd, {})).toBeNull();
    expect(
      refusal("plans/x.md", cwd, { ADVISOR_PLANS_DIR: "plans/" })
    ).toBeNull();
  });

  test("normalises an absolute path inside the repo", () => {
    expect(
      refusal("/repo/plans/x.md", cwd, { ADVISOR_PLANS_DIR: "docs/plans" })
    ).not.toBeNull();
  });

  test("treats a backslash-separated path like a slash-separated one", () => {
    // What `relative` returns on Windows; the guard must not depend on the host separator.
    expect(
      refusal("plans\\x.md", cwd, { ADVISOR_PLANS_DIR: "docs/plans" })
    ).not.toBeNull();
  });

  test("ignores a path outside the repo", () => {
    expect(
      refusal("/elsewhere/plans/x.md", cwd, { ADVISOR_PLANS_DIR: "docs/plans" })
    ).toBeNull();
  });
});

describe("the declared locations", () => {
  // CLAUDE.md is what the models read; the project scope's env block is what hooks and
  // plugins read. The two must say the same thing, and the table is the place to edit.
  // Only the *_DIR keys are compared, so an unrelated env value added later is ignored.
  const settings = JSON.parse(
    readFileSync(new URL("../.claude/settings.json", import.meta.url), "utf8")
  ) as { env: Record<string, string> };
  const declared = Object.fromEntries(
    Object.entries(settings.env)
      .filter(([key]) => key.endsWith("_DIR"))
      .map(([key, value]) => [key, trimSlashes(value)])
  );
  const claudeMd = readFileSync(
    new URL("../CLAUDE.md", import.meta.url),
    "utf8"
  );
  const rows = claudeMd
    .split("\n")
    .filter((line) => /^\|.*`[A-Z_]+_DIR`/.test(line))
    .map((line) => {
      const cells = line
        .split("|")
        .map((cell) => cell.trim().replace(/`/g, ""));
      return { variable: cells[2], directory: trimSlashes(cells[3]) };
    });

  test("CLAUDE.md's table and .claude/settings.json's env agree", () => {
    expect(rows.length).toBe(Object.keys(declared).length);
    for (const row of rows) {
      expect(declared[row.variable]).toBe(row.directory);
    }
  });

  test("every guarded output has a row in CLAUDE.md", () => {
    const variables = rows.map((row) => row.variable);
    for (const output of OUTPUTS) {
      expect(variables).toContain(output.variable);
    }
  });

  test("no row reuses a directory another row has retired", () => {
    // If advisor plans move to docs/plans and plan pages then move into plans/, the guard
    // would refuse every plan-page write. Reject that configuration here, not at write time.
    const inUse = new Set(Object.values(declared));
    for (const output of OUTPUTS) {
      const own = declared[output.variable];
      if (own === undefined || own === output.assumed) continue;
      expect(inUse.has(output.assumed)).toBe(false);
    }
  });
});
```

**Verify**: `bun test scripts/skill-output-guard` → `9 pass, 0 fail`.
Then `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step 5: Register the hook

Add a `hooks` key to `.claude/settings.json` so the whole file reads:

```json
{
  "env": {
    "ADVISOR_PLANS_DIR": "plans",
    "ISSUES_DIR": ".scratch",
    "ADR_DIR": "docs/adr",
    "RESEARCH_DIR": "docs/research",
    "PLANS_DIR": "artifacts/plans",
    "DIAGRAMS_DIR": "artifacts/diagrams",
    "DECISIONS_DIR": "artifacts/decisions"
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "command -v bun >/dev/null 2>&1 || exit 0; bun run \"$CLAUDE_PROJECT_DIR/scripts/skill-output-guard.ts\""
          }
        ]
      }
    ]
  }
}
```

Why the `command -v bun` prefix: the hook runs under `sh -c` (Git Bash on Windows) with
whatever `PATH` the Claude Code process inherited, and this file runs on every machine
that clones the repo. Where `bun` is missing or not on `PATH` — an app-launched session,
a reviewer without the toolchain — the guard exits 0 and `CLAUDE.md` remains the only
guard, which is the state of any repo without this plan; without the prefix every
`Write`/`Edit` would show a `hook error` notice there. (On Windows without Git Bash the
hook shell is PowerShell, the line is a syntax error, and every write shows that notice;
installing Git Bash is the fix, and Claude Code itself expects it.)

What happens next depends on where you are running:

- In the main checkout: Claude Code's file watcher normally registers the hook as soon as
  the file is saved, so your own remaining `Write`/`Edit` calls (Step 6, the index row)
  run through it. With this plan's values `refusal` returns `null` for every path, so
  nothing is refused and you will notice nothing. Every call now costs one `bun` start
  (tens of milliseconds); that is the accepted price.
- In an executor worktree under `.claude/worktrees/`: hooks are read from the session's
  project root (the main checkout), where this file does not exist yet, so the hook is not
  live for you. It takes effect once the branch is merged.

**Verify**:

- `bun -e 'const s = require("./.claude/settings.json"); console.log(s.hooks.PreToolUse[0].matcher)'` → `Write|Edit`
- `sh -c "$(bun -e 'console.log(require("./.claude/settings.json").hooks.PreToolUse[0].hooks[0].command)')" <<< '{"cwd":"'"$PWD"'","tool_input":{"file_path":"plans/x.md"}}'; echo "exit $?"`
  with `CLAUDE_PROJECT_DIR="$PWD"` exported first → `exit 0` (the real command line,
  run the way Claude Code runs it, lets a default-directory write through)
- The same line with `PATH=/usr/bin:/bin` prefixed (a shell without `bun`) → `exit 0`,
  no output (the no-op fallback)
- `bun test scripts/skill-output-guard` → still `9 pass` (the env-agreement test reads the file again)

No manual probe is meaningful with today's values (the hook lets everything through). The
first real exercise is the user's first relocated row; the "To relocate anything"
maintenance note says what to expect then.

### Step 6: Move files for any row the user changed

For each table row whose _Directory_ differs from _Directory the skill assumes_ **and**
whose old directory exists: `git mv <old> <new>`. With the table as written there is no such
row, and this step is a no-op — confirm that and move on.

If the user relocated `plans/`, also add one line under the `# Implementation Plans`
heading of the moved `README.md`: "Moved from `plans/` by plan 025; `ADVISOR_PLANS_DIR`
in `.claude/settings.json` names this directory. Older plan bodies say `plans/README.md`;
read that as this file."

**Verify**: for every changed row, `test ! -e <old> && test -d <new> && echo moved` →
`moved`; then `bun test` → `486 pass`. With no changed rows: `git status --short` shows no
rename (`R`) entries.

## Integration scenarios, end to end

How the committed files behave on machines with different Claude Code configurations.
None of these needs executor action; they are the reasoning behind the steps above.

1. **A machine with the skills installed in the personal scope** (`~/.claude/skills/` or
   `~/.agents/skills/` symlinked into it). Every session in this checkout exports the
   seven `*_DIR` variables; the hook runs on every `Write`/`Edit` and refuses nothing
   with today's values. `/improve`, `/to-tickets`, `/plan-pages` write exactly where they
   did before. The user's own hooks and plugins keep running (hooks merge).
2. **A machine with the same skills as plugins** (`plugin:skill` names) or as project
   skills. Same behaviour: the skills read `CLAUDE.md` and `docs/agents/*.md` from the
   repo, and neither the table nor the hook cares where a skill is installed.
3. **A machine with none of these skills.** The table is documentation, `docs/agents/`
   is unread, the `env` block is unused, and the hook refuses nothing. Nothing is
   harmed and nothing errors.
4. **A work machine whose user settings already set `PLANS_DIR` (or another row) for
   every project.** Inside this repo the project value wins — the repo declares its own
   layout — and outside it the user value is untouched. Step 0 records that this
   happened so nobody is surprised.
5. **A work machine with managed settings that set `disableAllHooks`,
   `allowManagedHooksOnly` or `strictPluginOnlyCustomization.hooks`.** The hook never
   runs; the `env` block still applies (it is a settings key, not a hook); the
   `CLAUDE.md` table is the only guard. Identical to a repo without the hook, which is
   the design.
6. **A machine without `bun` on the hook's `PATH`** (app-launched session, or a reviewer
   without the toolchain). The `command -v bun` prefix makes the hook a silent no-op;
   see scenario 5 for the rest.
7. **Windows.** Git Bash runs the hook; `refusal` compares paths with `/` regardless of
   the host separator (tested). Without Git Bash, see the note under Step 5.
8. **The user relocates advisor plans to `docs/plans/`** on any machine. Edit the row and
   the `env` value, `git mv plans docs/plans`, commit. On every machine from the next
   session: `/improve` reads `CLAUDE.md` and writes to `docs/plans/`; if it follows its
   own Hard Rule instead, the first `Write` into `plans/` is refused with "`plans/` is
   retired in this repo. Advisor plans live in `docs/plans/` (ADVISOR_PLANS_DIR)" and it
   retries in the right place. `/improve reconcile` and `execute` look for
   `plans/README.md` by name; the maintenance note covers the symlink fallback.
9. **A first clone on any machine.** The interactive trust dialog lists the hook once;
   after that it runs from the first session. `claude -p` runs it without a dialog.
10. **`/setup-matt-pocock-skills` run later, anywhere.** It picks `CLAUDE.md` (exists),
    finds the `## Agent skills` block and its `### Issue tracker` / `### Domain docs`
    sub-headings, and updates in place. It may add `### Triage labels` plus
    `docs/agents/triage-labels.md`; the `### Output locations` sub-heading is not one it
    knows, so review its diff to be sure it kept that section.
11. **`/improve execute 025` itself.** The executor works in `.claude/worktrees/<id>/`
    with `CLAUDE_PROJECT_DIR` at the main checkout, where no `.claude/settings.json`
    exists: the hook and `env` are not live for the executor. Everything is verified by
    the probes and tests instead.
12. **Boopervisor edits this repo's project-scope settings.** `mutateJsonFile`
    (`src/lib/config/mutate.ts`) "writes the change and leaves every other key untouched"
    (`src/lib/config/mutate.test.ts:92`), so the `env` and `hooks` keys survive.

## Test plan

- New: `scripts/skill-output-guard.test.ts` (Step 4), 9 tests: refusal message content;
  configured directory allowed; unset and equal-to-default not policed; absolute in-repo
  path normalised; backslash separators normalised; out-of-repo path ignored; CLAUDE.md
  table equals the `*_DIR` keys of the settings env (same count, same values); every
  `OUTPUTS` entry has a row; no row's directory is another row's retired default.
- Pattern: `src/lib/skills/read.test.ts` (`bun:test`, `describe`/`test`/`expect`).
- Verification: `bun test` → `486 pass, 0 fail` (477 at `eff98d2` plus the 9 new).
- There is no manual test: with today's values the hook is dormant by design.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] Step 0's output line is in the report
- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun test` → `486 pass, 0 fail`; `bun test scripts/skill-output-guard` → `9 pass`
- [ ] Step 2 probe 1 exits 2 with the "retired in this repo" message; probes 2 and 3 exit 0
- [ ] `head -1 CLAUDE.md` is `@AGENTS.md`, `grep -c "^## Agent skills" CLAUDE.md` is `1`, `grep -c '`[A-Z_]*_DIR`' CLAUDE.md` is `7`
- [ ] `git diff --quiet eff98d2 -- AGENTS.md` exits 0 (file untouched)
- [ ] `bun -e 'const s = require("./.claude/settings.json"); console.log(Object.keys(s.env).length, s.hooks.PreToolUse.length)'` → `7 1`
- [ ] The Step 5 `sh -c` probe exits 0, with and without `bun` on `PATH`
- [ ] `grep -rn "/Users/\|/opt/homebrew\|/home/" .claude/settings.json scripts/skill-output-guard.ts scripts/skill-output-guard.test.ts CLAUDE.md docs/agents/` prints nothing (no machine-specific path in any committed file)
- [ ] `test -f docs/agents/issue-tracker.md && test -f docs/agents/domain.md`
- [ ] For every table row the user changed, the old directory is gone and the new one
      exists; with the table as written, `git status --short` shows no `R` entries
- [ ] `git status` shows no file outside the in-scope list
- [ ] This plan's status row is updated in the index

## STOP conditions

Stop and report back (do not improvise) if:

- `CLAUDE.md` at the start is anything other than the single line `@AGENTS.md`, or an
  `## Agent skills` heading already exists in `CLAUDE.md` or `AGENTS.md` — someone ran
  `/setup-matt-pocock-skills` or edited it since `eff98d2`; merging two blocks is a human
  decision.
- `AGENTS.md` at the start differs from the `# Design` instructions followed by the marked
  Next.js block recorded at `eff98d2` — the drift is somebody's edit; report it.
- `.claude/settings.json` already exists in the repo.
- `docs/agents/` already exists.
- `bun test` before you change anything does not report `477 pass, 0 fail` — the baseline
  moved; report the numbers and stop.
- After Step 5, the guard refuses one of **your own** writes — with this plan's values it
  must refuse nothing, so that is a bug in `refusal`; report the message and the path
  rather than adding an allow-list. (A hook that _errors_ with any exit code other than 2
  is non-blocking and shows the user a warning; note it in your report and continue.)
- `bun run lint` rejects `import.meta.main` or the `readFileSync(0, …)` stdin read — report
  the exact rule; do not disable rules inline.
- The user has told you a different target for any row and the table was not updated to
  match — update the table first, then restart from Step 1.

## Maintenance notes

- **To relocate anything**: change one row in `CLAUDE.md`'s table and the matching `env`
  value in `.claude/settings.json` (the agreement test fails until both match), then
  `git mv` the contents, commit. Every machine picks the change up on its next session.
  Nothing else — the hook does the teaching on the first misplaced write. Read the plugin
  couplings listed under "The values are the user's" first; two of the rows
  (`ISSUES_DIR`, the three `artifacts/*` rows) have consequences in the `second-brain`
  plugins that this repo cannot fix.
- **Hosting the block in `CLAUDE.md`, not `AGENTS.md`**: chosen so that
  `/setup-matt-pocock-skills` (which prefers `CLAUDE.md`) and `next dev` (which owns
  `AGENTS.md`) each keep to their own file. Agents that read only `AGENTS.md` will not see
  the table; the `env` block and the hook are Claude Code features anyway. If a machine
  where other agents matter appears, the block can move after the `END` marker in
  `AGENTS.md` (it survives `next dev` there) with the test's read path following — at the
  cost of the setup-skill duplicate described in Current state.
- **Known gap**: the hook sees `Write` and `Edit` only. A skill that writes through `Bash`
  (`cat > plans/x.md`) or `NotebookEdit` is not stopped; `CLAUDE.md` is the only guard
  there. Extend the matcher only if this is observed.
- **Known gap**: an `Edit` of a file that still sits in a retired directory (the user
  changed the row but did not `git mv`) is refused with a message that says "write the
  file there instead"; the right action is the move. Finish the move and the refusals stop.
- If the user relocates `plans/`: shadcn's `improve` `reconcile` and `execute` variants
  hardcode `plans/README.md`. The block in `CLAUDE.md` and the hook are expected to
  redirect them; if a run insists on `plans/`, the fallback is a symlink from `plans` to
  the new directory **with** `ADVISOR_PLANS_DIR` set back to `plans` (the hook and the
  symlink conflict otherwise). Prefer fixing upstream:
  a one-paragraph change to that skill to honour an `ADVISOR_PLANS_DIR` variable, as the
  `second-brain` plugins already do.
- The user's other repositories may keep a fuller `docs/agents/` set (`triage-labels.md`,
  `adhd-writing.md`, an "Artifact feedback queue" section in `issue-tracker.md` that the
  `diagrams` plugin's `ready-feedback-nudge.sh` relies on; that plugin's nudges also tell
  the model to follow `docs/agents/adhd-writing.md`). If the artifact-feedback workflow is
  wanted here, copy those files in — a separate small task, not this plan.
- Reviewer focus: the `refusal` path normalisation (an absolute `file_path` is what Claude
  Code actually sends; backslashes on Windows); that the `CLAUDE.md` table survived
  prettier with its column order intact (the test parses columns 2 and 3); that
  `AGENTS.md` is byte-identical to `eff98d2`; that the hook command still has the
  `command -v bun` prefix; and that no committed file names a machine-specific path.
- Deferred, on purpose: rewriting the path with the hook's `updatedInput` (see the
  "Claude Code facts" section for why a refusal is preferred). A Boopervisor panel that
  edits this table and the `env` block is recorded as a direction candidate in the plans
  index.

## Review log

2026-09-02, reconcile before `/improve execute next` at `eff98d2`:

- Plans 018–024 had landed since the original plan. The clean baseline is now 477 tests
  across 54 files, so the expected total after this plan is 486; every operational gate
  and STOP condition now uses those numbers.
- `AGENTS.md` intentionally gained the repo's `# Design` instructions in plan 020. Its
  current bytes, including that section and the generated Next.js block, are the new
  untouched-file baseline.
- `scripts/extract-env-vars-reference.ts` now sits beside the two reference extractors.
  It does not overlap this plan's new guard files and is recorded in Current state.
- No other in-scope precondition drifted: `CLAUDE.md` remains the single line
  `@AGENTS.md`; `.claude/settings.json` and `docs/agents/` remain absent.

2026-09-01, `/improve review-plan` against the live repo and the Claude Code docs:

- The `AGENTS.md` excerpt omitted the two `nextjs-agent-rules` marker lines that wrap the
  block; the old `head -1` verification would have failed. Fixed.
- "Hook configuration is captured when a session starts" was wrong: the docs say hook
  edits are picked up by a file watcher. Step 5 and the STOP conditions now reflect that.
- The `.claude/worktrees/**` test STOP condition was unreachable (`bun test` → 398 pass,
  none from worktrees); replaced with the numeric baseline.
- `plans/` was in the drift check and would always differ; removed.
- The env-agreement test compared the row count with every `env` key; it now compares
  only `*_DIR` keys, so an unrelated env value does not break it.
- Added a test: a row may not reuse another row's retired default.
- Every Claude Code fact now carries its docs URL and a verbatim quote.

2026-09-01, second pass, `/improve plan` on integration with an existing configuration:

- The `## Agent skills` block moves from `AGENTS.md` to `CLAUDE.md`: Matt Pocock's setup
  skill edits `CLAUDE.md` when it exists and would have appended a second block there.
  `AGENTS.md` is now out of scope entirely.
- The hook command is prefixed with `command -v bun >/dev/null 2>&1 || exit 0`, because
  hooks run under `sh -c` with the inherited `PATH`; a session without `bun` on `PATH`
  would otherwise see a `hook error` on every write.
- Recorded the `second-brain` plugin couplings (`ready-feedback-nudge.sh` hardcodes
  `.scratch/artifact-feedback`, `plan-artifact-nudge.sh` matches `plans|.scratch|specs?|tickets?`
  path segments, `diagram-open` review mode needs `artifacts/`) next to the values table.
- Trust facts corrected: settings-file hooks and the `env` block apply before the folder is
  trusted (permissions page), so a clone's first session runs the hook.
- Evidence from the author's machine that day (kept here only as evidence, not as a
  precondition): user-level `~/.claude/settings.json` had no `*_DIR` key in `env` and a
  single `SessionStart` hook; enabled plugins were `diagrams`, `plans` and `decisions`
  from `second-brain`, and the `diagrams` plugin's hooks were two `UserPromptSubmit`
  nudges and one `PostToolUse` nudge on `Write` (which runs only after a successful
  write, so a refused write never triggers it); skills were personal-scope symlinks into
  `~/.agents/skills/`; `bun` was `/opt/homebrew/bin/bun` 1.3.14.
- Dry-run in a scratch copy (no repo change): the Step 2 script, Step 3a block, Step 4 tests
  and Step 5 hook command, extracted verbatim from this file, produced every expected output
  — probes 1–3, the `sh -c` probe (exit 0 today, exit 2 with `ADVISOR_PLANS_DIR=docs/plans`,
  exit 0 with no `bun` on `PATH`), and all tests passing.

2026-09-01, third pass, on the requirement that the result work on **any machine**
(the user's work configuration included):

- Added the "Portability contract": committed files only, no machine-specific path, the
  hook is enforcement on top of a declaration and always degrades silently.
- Step 0 changed from a gate to an informational record: a user-level `*_DIR` value is
  overridden by the project scope by design, extra hooks merge, and a disabled hook still
  leaves the `CLAUDE.md` table in force. It now finds the home directory via `node:os`.
- `refusal` normalises `\` to `/` so the same check holds on Windows; ninth test added.
- Added the managed-settings facts (`disableAllHooks`, `allowManagedHooksOnly`,
  `strictPluginOnlyCustomization.hooks`) and the Windows hook-shell note.
- Scenarios rewritten per machine type (personal skills, plugin skills, no skills,
  user-level `*_DIR`, managed hook policy, no `bun`, Windows, first clone).
- New done criterion: no committed file contains `/Users/`, `/opt/homebrew` or `/home/`.
- Machine-specific observations moved out of "Current state" into this log.
