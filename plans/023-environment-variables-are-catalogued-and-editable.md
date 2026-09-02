# Plan 023: Claude Code's environment variables are catalogued from the reference, and the `env` setting is edited as a list of named variables with their documented purpose

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 547101c..HEAD -- scripts src/lib/catalog src/components/settings/control-component.tsx src/components/settings/controls src/components/settings/settings-list.tsx src/components/ui/picker.tsx package.json .prettierignore docs/settings-catalog.md`
> Plans 018 and 022 change most of these on purpose (this plan builds on
> 022's `Picker`, `offered()` and typed dispatch). Read the live files; the
> excerpts below are from 022's specification where 022 is the author.
>
> **Base check**: `git merge-base --is-ancestor 547101c HEAD && echo ok` prints
> `ok`, `src/components/ui/picker.tsx` exists, and
> `grep -n "function offered" src/components/settings/control-component.tsx` matches.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW/MED (a new data file, a new control for one key, one new
  option source; the write path is unchanged)
- **Depends on**: plans/022-every-option-set-is-a-searchable-picker.md
- **Category**: direction (requested feature)
- **Planned at**: commit `547101c`, 2026-09-01

## Why this matters

The `env` setting is "an open map of environment variables; no schema to
render" (`src/lib/catalog/overrides.ts:121`), so it is edited as raw JSON,
and nothing in the interface says what `CLAUDE_CODE_EFFORT_LEVEL` or
`API_TIMEOUT_MS` do. Claude Code documents 349 variables in one table at
https://code.claude.com/docs/en/env-vars, each with a purpose sentence. The
operator asked for those variables to be displayed with accurate, cited
descriptions.

The catalog already has the machinery: two extraction scripts that fetch a
reference page by hand, write a committed JSON file, and a module that reads
it (ADR 0003, `docs/settings-catalog.md`). This plan adds a third for the
variables, a control for `env` that edits it as named rows — each name a
searchable picker over the documented variables, each row showing the
reference's own words for it and a link to where they came from — and gives
`httpHookAllowedEnvVars` the same list for its entries. `docs/PLAN.md:70`
said `env` gets a JSON editor "until [it proves it needs] more"; this is that proof.

## Current state

### The reference page

`https://code.claude.com/docs/en/env-vars.md` (fetched 2026-09-01: 523
lines). Headings: `# Environment variables`, `## Set environment variables`
(`### In your shell`, `### In settings files`), `## Precedence`,
`## Variables`, `## Features that need feature-flag fetching`
(`### First session after an install or upgrade`), `## See also`.

`## Variables` (line 115 to the next `## `) holds a note and **one table**
with two columns, `Variable | Purpose`, 349 rows shaped like:

```
| `CLAUDE_CODE_EFFORT_LEVEL`                              | Set the effort level for supported models. Values: `low`, `medium`, `high`, `xhigh`, `max`, or `auto` to use the model default. Available levels depend on the model. Takes precedence over `--effort`, `/effort`, and the `modelSettings` and `effortLevel` settings. See [Adjust effort level](/docs/en/model-config#adjust-effort-level) |
| `API_TIMEOUT_MS`                                        | Timeout for API requests in milliseconds (default: 600000, or 10 minutes; maximum: 2147483647). Increase this when requests time out on slow networks or when routing through a proxy. Values above the maximum overflow the underlying timer and cause requests to fail immediately |
```

Every first cell is exactly one backticked upper-case name (checked: zero
rows with a comma or a second name). Purposes contain code spans and
Markdown links with site-relative paths (`/docs/en/...`). The table has no
per-row anchors; the citable location is the section, `env-vars#variables`.

Before the table, inside `<Note> … </Note>`, a bullet list names the
variables that are read by presence only ("any non-empty value including `0`
turns the behavior on"):

```
  * `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`
  * `DISABLE_TELEMETRY`
  * `DISABLE_ERROR_REPORTING`
  * `CLAUDE_CODE_TMUX_TRUECOLOR`
  * `FALLBACK_FOR_ALL_PRIMARY_MODELS`
  * `IS_DEMO`
```

`## Precedence` says, in prose worth carrying into the interface: "When the
same variable is set in both your shell and a settings file `env` block, the
settings file value applies" and "In a settings file you can set a variable
but you can't remove one. To override a variable you can't unset … set it to
an empty string in the `env` block".

### The extractor pattern to copy

`scripts/extract-hooks-reference.ts` (66 lines): fetches `SOURCE`, finds a
`## ` section, walks its lines, writes
`{ source, extractedAt, events }` to `src/lib/catalog/hooks.data.json` with
`Bun.write(OUT, JSON.stringify(..., null, 2) + "\n")`, and prints counts and
anything needing a human eye. Its `plain()` strips links to their label and
removes backticks; the settings extractor's `plain()`
(`scripts/extract-settings-reference.ts:33-37`) keeps backticks, which the
interface renders as `<code>` (`setting-details.tsx:8-18`, `withCodeSpans`).
Use the settings one. `package.json` scripts:

```json
    "catalog:settings": "bun run scripts/extract-settings-reference.ts",
    "catalog:hooks": "bun run scripts/extract-hooks-reference.ts",
    "catalog": "bun run catalog:settings && bun run catalog:hooks",
```

### The module pattern to copy

`src/lib/catalog/hooks.ts` (24 lines):

```ts
import data from "./hooks.data.json";
export type HookEvent = { event: string; summary: string; docUrl: string };
export const HOOKS_SOURCE = data.source;
export const HOOKS_EXTRACTED_AT = data.extractedAt;
export const HOOK_EVENTS: HookEvent[] = data.events;
const BY_EVENT = new Map(HOOK_EVENTS.map((e) => [e.event, e]));
export function getHookEvent(event: string): HookEvent | undefined {
  return BY_EVENT.get(event);
}
export function isUnknownHookEvent(event: string): boolean {
  return !BY_EVENT.has(event);
}
```

`src/lib/catalog/index.ts:5-7` re-exports `./types`, `./hooks`, `OVERRIDES`.

**Bundle rule.** Every client component imports `@/lib/catalog` as
`import type` only (`setting-row.tsx:10`, `control-component.tsx:4`), so
the 128 KB `settings.data.json` never reaches the browser. The one exception
today — `hooks-editor.tsx:8` value-imports `@/lib/catalog/hooks` — ships
12 KB it should not. The new data file must not be value-imported from any
`"use client"` file; it reaches the control as props from the server, the
same channel `options` uses (`settings-list.tsx`, `resolveOptions`).

### What 022 leaves in place

- `src/components/ui/picker.tsx` — `Picker` with `PickerOption { value; description? }`,
  `mode: "strict" | "free"`, controlled `value`/`onValueChange`, optional
  `name` for a hidden field.
- `src/components/settings/control-component.tsx` — an exhaustive `switch`
  over `definition.control` and `offered(definition, options): string[]`.
- `src/components/settings/controls/string-list.tsx` — `suggestions?: string[]`
  renders a free `Picker` per entry.
- `src/lib/catalog/types.ts` — `Control` union (ten members) and
  `OptionSource = "models" | "outputStyles" | "themes" | "agents"`.
- `settings-list.tsx` `resolveOptions()` — resolves every source once and
  passes the whole map to every row.

### Formatting

`.lintstagedrc` runs `prettier --ignore-unknown --write` on every staged
file, and `prettier --check src/lib/catalog/settings.data.json` fails today:
the extractor's `JSON.stringify(…, null, 2)` and Prettier disagree on short
arrays. Committing a regenerated data file therefore reformats it wholesale.
`.prettierignore` currently lists `.next`, `node_modules`, `bun.lock`,
`tsconfig.tsbuildinfo`.

### Copy and design rules

`DESIGN.md`: sentence case; no em dash; `…`; mono only for identifiers
(a variable name is one; its purpose sentence is not); helpers "only when
needed"; no pill for ordinary metadata. `CONTEXT.md`: a **setting** is the
`env` key; the things inside it are **variables**.

## Commands you will need

| Purpose                            | Command                                          | Expected on success                                              |
| ---------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| Extract (network)                  | `bun run catalog:env-vars`                       | prints `variables: ~349`, `no purpose: none`, `duplicates: none` |
| Route types (once, fresh worktree) | `bunx next typegen`                              | `✓ Types generated successfully`                                 |
| Typecheck                          | `bun run typecheck`                              | exit 0                                                           |
| Lint                               | `bun run lint`                                   | exit 0                                                           |
| Tests                              | `bun test`                                       | `0 fail`                                                         |
| Catalog                            | `bun test src/lib/catalog`                       | all pass                                                         |
| Format                             | `bunx prettier --check <touched non-data files>` | exit 0                                                           |

## Scope

**In scope**:

- `scripts/extract-env-vars-reference.ts` (create)
- `src/lib/catalog/env-vars.data.json` (create, generated)
- `src/lib/catalog/env-vars.ts` (create), `src/lib/catalog/index.ts` (one re-export)
- `src/lib/catalog/types.ts` (`Control` + `OptionSource` members), `overrides.ts` (two entries), `catalog.test.ts`
- `src/components/settings/controls/env-map.tsx` (create), `env-map.test.tsx` (create), `controls/index.ts` (export)
- `src/components/settings/control-component.tsx`, `control-component.test.tsx`
- `src/components/settings/settings-list.tsx` (`resolveOptions` and the row's `options` prop)
- `src/components/settings/setting-row.tsx` (prop type only, if `options` changes shape)
- `package.json` (scripts), `.prettierignore`
- `docs/settings-catalog.md`, `docs/PLAN.md` (line 70), `README.md` (one clause)
- `plans/README.md` (status row)

**Out of scope**:

- `src/lib/catalog/settings.data.json`, `hooks.data.json` — not regenerated.
- Masking secret values in `env` (an API key is a common value) — a direction
  candidate in the index ("Redact secrets in the history and in backups");
  the value field here is plain text like every other.
- `sandbox.credentials.envVars` (array of objects with `name` and `mode`) —
  needs an object editor; recorded as a follow-up.
- `SettingDetails` linking variable names it mentions in prose — follow-up.
- `hooks-editor.tsx`'s own catalog import — plan 024 territory; do not fix here.

## Git workflow

- Branch: `advisor/023-environment-variables-are-catalogued-and-editable`, from `main` after 022.
- Commit per step; imperative sentence, no prefix. The generated data file
  goes in its own commit titled `Extract the environment variables reference into the catalog`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Keep Prettier off generated catalog data

Append to `.prettierignore`:

```
# Generated by scripts/extract-*-reference.ts; the extractor's formatting is the committed one.
src/lib/catalog/*.data.json
```

**Verify**: `bunx prettier --check src/lib/catalog/settings.data.json` → prints that the file is ignored / exit 0.

### Step 2: The extractor

Create `scripts/extract-env-vars-reference.ts` modelled on the hooks script:

```ts
/**
 * Extracts Claude Code's environment variable reference into the catalog.
 *
 * Companion to extract-settings-reference.ts and extract-hooks-reference.ts: run by hand,
 * output reviewed and committed. The `env` editor offers these names and shows each
 * variable's documented purpose.
 *
 *   bun run scripts/extract-env-vars-reference.ts
 */
const SOURCE = "https://code.claude.com/docs/en/env-vars.md";
const DOC_URL = "https://code.claude.com/docs/en/env-vars#variables";
const OUT = new URL("../src/lib/catalog/env-vars.data.json", import.meta.url)
  .pathname;
```

- Fetch as the other scripts do; throw on a non-OK status.
- `plain()` as in the settings extractor (strip links to their label, keep
  backticks, collapse whitespace).
- Locate the section: `start` = index of the line matching `/^## Variables\s*$/`,
  `end` = next line after it matching `/^## /`. Throw if `start === -1`.
- Presence-only names: within the section, lines matching
  `/^\s*\* `([A-Z][A-Z0-9_]*)`\s*$/` **before** the first table row.
- Rows: lines matching `/^\|\s*`([A-Z][A-Z0-9_]*)`\s*\|(.*)\|\s*$/` →
  `{ name, purpose: plain(cell), presenceOnly: names.has(name), docUrl: DOC_URL }`.
- Sort by name; write `{ source: SOURCE, extractedAt: <YYYY-MM-DD>, variables }`.
- Report: `variables: N`, `presence-only: N`, `no purpose: <names or none>`,
  `duplicates: <names or none>`, `wrote <path>`.

Add to `package.json`:

```json
    "catalog:env-vars": "bun run scripts/extract-env-vars-reference.ts",
    "catalog": "bun run catalog:settings && bun run catalog:hooks && bun run catalog:env-vars",
```

Run `bun run catalog:env-vars`.

**Verify**: the report shows about 349 variables (±10%), `presence-only: 6`,
`no purpose: none`, `duplicates: none`. `bun -e 'const d = require("./src/lib/catalog/env-vars.data.json"); console.log(d.variables.length, d.variables.find(v => v.name === "CLAUDE_CODE_EFFORT_LEVEL").purpose.slice(0, 40))'`
prints the count and `Set the effort level for supported models`.
`git status --short` shows only the two script/package changes and the new
data file. If the count is far off or a purpose is empty, STOP: the page's
layout changed and the regexes need a human.

### Step 3: The module

Create `src/lib/catalog/env-vars.ts`:

```ts
import data from "./env-vars.data.json";

export type EnvVar = {
  name: string;
  /** The reference's own words. Code spans are backticked; render with `withCodeSpans`. */
  purpose: string;
  /** Read by presence: any non-empty value turns it on, only unsetting turns it off. */
  presenceOnly: boolean;
  docUrl: string;
};

export const ENV_VARS_SOURCE = data.source;
export const ENV_VARS_EXTRACTED_AT = data.extractedAt;
/** Every documented variable, sorted by name. */
export const ENV_VARS: EnvVar[] = data.variables;
const BY_NAME = new Map(ENV_VARS.map((v) => [v.name, v]));
export function getEnvVar(name: string): EnvVar | undefined {
  return BY_NAME.get(name);
}
export function isUnknownEnvVar(name: string): boolean {
  return !BY_NAME.has(name);
}
```

Add `export * from "./env-vars";` to `src/lib/catalog/index.ts`.

Add to `catalog.test.ts`:

- `environment variables are extracted, unique, and described` — `ENV_VARS.length > 300`,
  names unique, no empty `purpose`, every `docUrl` ends with `#variables`.
- `the variables the settings reference names are present` — for each of
  `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `CLAUDE_CODE_EFFORT_LEVEL`,
  `API_TIMEOUT_MS`, `DISABLE_TELEMETRY`: `getEnvVar(name)?.name === name`;
  `getEnvVar("DISABLE_TELEMETRY")?.presenceOnly === true`;
  `isUnknownEnvVar("NOT_A_VARIABLE") === true`.

**Verify**: `bun test src/lib/catalog` → all pass; `bun run typecheck` → 0.

### Step 4: Options carry descriptions

Widen the server-to-row channel so a source can carry a description:

- `settings-list.tsx`: `resolveOptions()` returns
  `Partial<Record<OptionSource, PickerOption[]>>` (import the type from
  `@/components/ui/picker`). Disk sources map `name => ({ value: name })`.
  Add `"envVars"` to `OptionSource` in `types.ts` and resolve it **without
  the disk**: `ENV_VARS.map((v) => ({ value: v.name, description: v.purpose }))`
  (server-side import of `@/lib/catalog` is fine; this file is a server component).
- Pass each row only the sources its definition names, so the 349-entry list
  (about 120 KB serialised) travels with two rows rather than 209:

```tsx
function optionsFor(
  definition: SettingDefinition | undefined,
  all: Options
): Options {
  if (!definition?.optionSource) return {};
  return { [definition.optionSource]: all[definition.optionSource] ?? [] };
}
```

and `options={optionsFor(definition, options)}` on both `<SettingRow>` sites.

- `setting-row.tsx` and `control-component.tsx`: the `options` prop type
  follows (`Partial<Record<OptionSource, PickerOption[]>>`); `offered()`
  returns `PickerOption[]` (catalog `suggestions`/`enumValues` map to
  `{ value }`); `ComboboxControl.suggestions` and `StringListControl.suggestions`
  become `PickerOption[]` and are passed straight to `Picker`.

**Verify**: `bun run typecheck` → 0; `bun test src/components/settings` → all pass
(update 022's tests where they built `suggestions` as strings).

### Step 5: The `envMap` control

Add `"envMap"` to the `Control` union (`types.ts`) with the comment
`// an object of variable name to string value, edited as rows`.

Create `src/components/settings/controls/env-map.tsx` (`"use client"`):

```tsx
export interface EnvMapControlProps {
  value: unknown;
  /** The documented variables, name and purpose; empty when the server had none to give. */
  variables: PickerOption[];
}
```

- Seed `entries: { name: string; value: string }[]` from
  `Object.entries(value)` when `value` is a non-null, non-array object
  (values coerced with `String`), else `[]`.
- One row per entry, `flex flex-col gap-1`:
  - a `flex gap-2` line with a name `Picker` (`mode="free"`,
    `options={variables}`, `id={`${baseId}-${index}-name`}`,
    `aria-label={`Variable ${index + 1} name`}`, `placeholder="NAME"`,
    `className="flex-1"`), a value `Input` (`id={…-value}`,
    `aria-label={`Variable ${index + 1} value`}`, `autoComplete="off"`,
    `spellCheck={false}`, `className="flex-1 font-mono"`), and a ghost
    `Button` `aria-label={`Remove variable ${index + 1}`}` with the trash icon
    (no `text-red-900`; plan 024 removes it elsewhere too).
  - under it, the purpose: look the trimmed name up in `variables`
    (a `Map` built once with `useMemo`). Found →
    `<p className="text-sm text-gray-900">{withCodeSpans(description)} <a href="https://code.claude.com/docs/en/env-vars#variables" target="_blank" rel="noreferrer" className="font-mono underline">env-vars#variables</a></p>`
    (move `withCodeSpans` from `setting-details.tsx` into a small shared
    module `src/components/settings/code-spans.tsx` and import it in both).
    Not found and the name is non-empty →
    `<p className="text-sm text-gray-900">Not in Claude Code's environment variables reference. It is still set for the session and its subprocesses.</p>`.
  - a duplicate name (same trimmed name as an earlier row) marks that row's
    name picker `aria-invalid` and shows `Set twice above; the last value wins.`
- A `Add variable` secondary `size="sm"` button (text only).
- Above the rows, one sentence from the reference, once:
  `A value here overrides the same variable exported in your shell. To cancel a shell export, set the variable to an empty string.`
  (`text-sm text-gray-900`).
- Hidden field: `<input type="hidden" name="value" value={JSON.stringify(Object.fromEntries(entries.filter((e) => e.name.trim() !== "").map((e) => [e.name.trim(), e.value])))} />`.
  With no named entries this is `{}`; Unset removes the key.

Wire it: `overrides.ts`:

```ts
  env: {
    note: "A map of variable name to string value. Edited as rows; names are offered from the environment variables reference, with each variable's documented purpose.",
    control: "envMap",
    optionSource: "envVars",
  },
  httpHookAllowedEnvVars: {
    note: "Each entry is a variable name; the reference's list is offered.",
    optionSource: "envVars",
  },
```

`controls/index.ts`: export `EnvMapControl`. `control-component.tsx`:
`case "envMap": return <EnvMapControl value={value} variables={offered(definition, options)} />;`

Create `env-map.test.tsx`:

1. `renders one row per variable with name and value` — `value={{ API_TIMEOUT_MS: "1200000", FOO: "bar" }}`:
   two name comboboxes with those values, two value textboxes.
2. `shows the documented purpose under a known name, with the reference link` —
   `variables={[{ value: "API_TIMEOUT_MS", description: "Timeout for API requests in milliseconds" }]}`:
   that text is present and a link to `https://code.claude.com/docs/en/env-vars#variables` exists.
3. `says when a name is not in the reference` — `FOO` shows `Not in Claude Code's environment variables reference`.
4. `offers the documented names while typing` — ArrowDown in a name field lists `API_TIMEOUT_MS`.
5. `submits the map as JSON, dropping unnamed rows` — click `Add variable`, leave it blank:
   `JSON.parse(hiddenValue())` equals the original object.
6. `flags a duplicate name` — two rows named `FOO`: the second is `aria-invalid` and the warning shows; the hidden value has one `FOO`.
7. `every input has its own id` — three rows: six ids, all distinct.
8. `an empty map submits {}` — `value={undefined}`: `hiddenValue() === "{}"`.

Update `control-component.test.tsx`'s table: `envMap` → a hidden `input[name="value"]`.

**Verify**: `bun test src/components/settings` → all pass; `bun run typecheck` → 0;
`grep -rn "from \"@/lib/catalog" src/components --include='*.tsx' | grep -v "import type" | grep -v hooks-editor` → no matches (the new data never enters a client file).

### Step 6: Docs

- `docs/settings-catalog.md`: add `bun run catalog:env-vars # -> src/lib/catalog/env-vars.data.json`
  to the script block, add `- Environment variables: https://code.claude.com/docs/en/env-vars.md`
  under "Primary sources", and in "What the extraction found" add a
  paragraph: `Environment variables, extracted <date>: **N variables** from
the one table under "Variables", 6 of them read by presence only. The
table has no per-row anchors, so every entry cites the section.` Replace
  the sentence naming `env` in the `pluginConfigs` paragraph ("Same for
  `env`, …") so it no longer lists `env`.
- `docs/PLAN.md:70`: `\`sandbox\` and \`pluginConfigs\` get a validated JSON editor until they prove they need more; \`env\` is edited as named variables with the reference's description of each.`
- `README.md`, "What it covers", Settings bullet: append `; the \`env\` setting is edited variable by variable, with each one's documented purpose`.

**Verify**: `grep -n "env-vars" docs/settings-catalog.md` → ≥2 matches.

### Step 7: Gates, manual check, index

`bun run typecheck` 0 · `bun run lint` 0 · `bun test` 0 fail · prettier
check on touched non-data files 0. Manual (`bun dev`, `/settings`, expand
`env`): rows for what is on disk with purposes; `Add variable`, type `CLAUDE_CODE_EFF`,
pick `CLAUDE_CODE_EFFORT_LEVEL` — its purpose appears with the link; set a
value; Save writes `{"...": "..."}` (check the History diff); restore.
Expand `httpHookAllowedEnvVars`: entries offer the names. Update the index row.

## Test plan

Steps 3 and 5. Patterns: `catalog.test.ts` for the data guards,
`string-list.test.tsx` for the hidden-field round trip, 022's
`picker.test.tsx` for opening a picker with ArrowDown.

## Done criteria

- [ ] `src/lib/catalog/env-vars.data.json` exists with ≥ 300 variables; `bun run catalog:env-vars` reproduces it with no diff except `extractedAt`
- [ ] `bun run typecheck`, `bun run lint`, `bun test` exit 0; 10 new tests pass
- [ ] `grep -rn "control: \"envMap\"" src/lib/catalog/overrides.ts` matches; `bun -e 'const c = await import("./src/lib/catalog/index.ts"); console.log(c.getSetting("env").control, c.getSetting("httpHookAllowedEnvVars").optionSource, c.ENV_VARS.length > 300)'` prints `envMap envVars true`
- [ ] `grep -rn "from \"@/lib/catalog" src/components --include='*.tsx' | grep -v "import type" | grep -v hooks-editor` → no matches
- [ ] `grep -n "catalog:env-vars" package.json` → 2 matches (its own script and `catalog`)
- [ ] `grep -n "data.json" .prettierignore` → 1 match
- [ ] `git status --short` shows nothing outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

- The fetch fails, `## Variables` is missing, or the table's first column is
  not one backticked name per row — report the shape you see.
- Fewer than 300 variables extracted, or any purpose empty.
- 022 has not landed (no `picker.tsx`, no `offered()`).
- You need to value-import `@/lib/catalog` or `env-vars.data.json` from a
  `"use client"` file to make something work — stop; the props channel is the design.
- A step's verification fails twice.

## Maintenance notes

- Re-run `bun run catalog:env-vars` when the reference changes; the catalog
  test fails if a variable the settings reference names disappears.
- The `env` row now ships ~120 KB of purposes in the page payload. If
  `/settings` ever needs to be lighter, trim `description` to its first
  sentence in `resolveOptions()` and fetch the rest on demand — recorded in
  the index with the row lazy-mount idea.
- `sandbox.credentials.envVars` and `SettingDetails`' variable names in
  prose are the natural next consumers of `getEnvVar`.
- Reviewer focus: the hidden JSON for duplicate and blank rows, and that the
  data file is byte-identical to a fresh extraction apart from the date.
