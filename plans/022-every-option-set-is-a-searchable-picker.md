# Plan 022: Every setting with a known set of values offers it in a searchable picker, and the catalog names the sets it missed

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 547101c..HEAD -- src/components/settings/control-component.tsx src/components/settings/controls src/components/ui src/lib/catalog/overrides.ts src/lib/catalog/types.ts src/lib/catalog/catalog.test.ts src/lib/config/option-sources.ts src/lib/config/option-sources.test.ts src/components/settings/settings-list.tsx docs/settings-catalog.md docs/PLAN.md README.md`
> Plans 018–021 change `control-component.tsx` (a `permissionRules` block and
> a `literal ?? ""`), `literal-toggle.tsx`, `switch.tsx`, `permission-rules.tsx`,
> `select.test.tsx`, `hooks-editor.tsx` and `settings-list.tsx`. Those are
> expected and were reconciled against `a8e1ba0`; read the live files. Any other
> in-scope change: compare the "Current state" excerpts; on a mismatch STOP.
>
> **Base check**: `git merge-base --is-ancestor 547101c HEAD && echo ok` prints
> `ok`, and plan 018 is merged in (`grep -n 'controlProps.list = list' src/components/settings/control-component.tsx` matches).

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (replaces the control behind 29 keys and the dispatch behind
  all of them; every path gets a test)
- **Depends on**: plans/018-the-settings-form-writes-what-it-shows.md
  (control-component and controls); 019 recommended (row tests to lean on)
- **Category**: direction (requested feature) + bug
- **Planned at**: commit `a8e1ba0`, reconciled 2026-09-02 from the original
  `547101c` plan after plans 018–021 landed

## Why this matters

The operator asked that every setting with a set of options present them in
a searchable dropdown picker. Today 23 keys with a closed set use a Radix
`Select` you cannot type into, 6 keys with an open set use a native
`<datalist>` (unstyled, and it shows nothing on some browsers until you
type), and several keys whose values _are_ a known set offer nothing at all:
each entry of `fallbackModel` and `availableModels` is a model alias,
`teammateDefaultModel` is a model, `agent` is the name of an agent on disk.

Reading the catalog for this also surfaced three defects, all confirmed by
running the modules:

- `fallbackModel` cannot be saved: the reference now types it as an array,
  the override still says `combobox`, and the server parses the typed text
  as JSON (`parseValueForSetting("opus", fallbackModel)` → `Not valid JSON`).
- `theme` refuses the `custom:<slug>` forms its own note says are valid:
  the override keeps seven `enumValues`, and the string validator rejects
  anything else (`validateSetting("custom:mine", theme)` → `Must be one of: …`).
- `agent` is a string ("the name of a built-in or custom agent") but the
  override still gives it the JSON editor, so a bare name is refused.

One picker primitive, one typed dispatch, and a handful of override fixes
close all of this.

## Current state

### The controls being replaced

`src/components/settings/controls/select.tsx` (Radix Select, no search):

```tsx
export function SelectControl({ value, enumValues }: SelectControlProps) {
  return (
    <Select name="value" defaultValue={typeof value === "string" ? value : ""}>
      {enumValues.map((allowed) => (
        <SelectItem key={allowed} value={allowed}>
          {allowed}
        </SelectItem>
      ))}
    </Select>
  );
}
```

`src/components/settings/controls/combobox.tsx` (native datalist; the
`optionSource` prop is never passed, so its placeholder is dead):

```tsx
export function ComboboxControl({
  value,
  suggestions = [],
  optionSource,
}: ComboboxControlProps) {
  const listId = useId();
  return (
    <>
      <Input
        name="value"
        list={listId}
        defaultValue={typeof value === "string" ? value : ""}
        placeholder={
          optionSource ? `Resolved from ${optionSource}...` : undefined
        }
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      )}
    </>
  );
}
```

`src/components/settings/controls/string-list.tsx` — one `Input` per entry,
controlled (`value={entry}`), serialised as JSON in a hidden `value` field
(`:54,109`). Entries have no suggestions.

### The dispatch

`src/components/settings/controls/index.ts:31-55` casts every control to
`ComponentType<Record<string, unknown>>`; `control-component.tsx:35-55`
builds an untyped prop bag:

```tsx
const controlProps: Record<string, unknown> = { value };
if (definition.control === "select") {
  controlProps.enumValues = definition.enumValues;
}
if (definition.control === "combobox") {
  // A machine-local list when there is one, the catalog's suggestions when there is not.
  const local = definition.optionSource
    ? (options[definition.optionSource] ?? [])
    : [];
  controlProps.suggestions = local.length > 0 ? local : definition.suggestions;
}
if (definition.control === "literalToggle") {
  controlProps.literal = definition.literal;
}
return <SelectedControl {...controlProps} />;
```

Note the combobox path reads `definition.suggestions` only: `theme` keeps its
seven values in `enumValues`, so its combobox shows no suggestions at all.

### The catalog

`src/lib/catalog/types.ts:31-32`: `export type OptionSource = "models" | "outputStyles" | "themes";`
and `SettingOverride` (`:49-68`) with `control`, `valueType`, `enumValues`,
`suggestions`, `optionSource`, `literal`, `virtual`, `dangerous`, `note`.

`src/lib/catalog/overrides.ts` entries this plan changes:

```ts
  fallbackModel: {
    note: "Same value space as `model`.",
    control: "combobox",
    optionSource: "models",
    suggestions: ["fable", "opus", "sonnet", "haiku"],
  },
  ...
  theme: {
    note: 'Closed set plus two open-ended forms, `custom:<slug>` and `custom:<plugin>:<slug>`, which are patterns rather than values.',
    control: "combobox",
    optionSource: "themes",
    enumValues: [ "auto", "dark", "light", "dark-daltonized", "light-daltonized", "dark-ansi", "light-ansi" ],
  },
  ...
  agent: { note: "Object describing a subagent: prompt, tools, and model.", control: "json" },
```

Extracted facts (`src/lib/catalog/settings.data.json`, regenerated only by
hand — do not regenerate it in this plan):

| key                    | valueType | typeText                                                                |
| ---------------------- | --------- | ----------------------------------------------------------------------- |
| `fallbackModel`        | array     | `array of model aliases or IDs; "default" expands to the default model` |
| `availableModels`      | array     | `array of model aliases or IDs`                                         |
| `teammateDefaultModel` | string    | (a model; today `text`)                                                 |
| `agent`                | string    | `string, the name of a built-in or custom agent`                        |

Effective controls at `547101c`: 23 `select`, 6 `combobox` (`advisorModel`,
`fallbackModel`, `language`, `model`, `outputStyle`, `theme`), 31 `stringList`,
83 `switch`, 23 `text`, 26 `json`, 9 `number`, 4 `literalToggle`, 3
`permissionRules`, 1 `hooks`.

`src/lib/catalog/catalog.test.ts:43-46` guards `select` keys having ≥2 values
and `:64-68` asserts `language`/`model` are comboboxes.

### Option sources

`src/lib/config/option-sources.ts:25-38` — server-only;
`resolveOptionSource(source, homeDir = homedir())` returns built-in +
on-disk output styles, and `[]` for `models` and `themes`. Tested in
`option-sources.test.ts` against a `mkdtemp` home. `settings-list.tsx:145-155`
resolves all sources once per render into `options` and hands it to every row.
`SettingsLocation.projectRoot` (`src/lib/config/settings.ts:25-30`) is
available in `SettingsList` as `location.projectRoot`.

Claude Code's agents live at `~/.claude/agents/*.md` and `.claude/agents/*.md`
(docs: https://code.claude.com/docs/en/sub-agents); a file's frontmatter
`name:` names the agent, else its file name — the same rule the output-styles
reader applies (`option-sources.ts:58-66`).

### UI primitives and conventions

- `src/components/ui/control.ts` — `controlClassName`, the shared skin.
- `src/components/ui/select.tsx:66-69` — the popover skin to reuse for the
  list: `rounded-medium bg-background-100 p-1 shadow-menu`, items
  `rounded-base py-1.5 pl-2 pr-2 text-sm text-gray-1000 data-[highlighted]:bg-gray-100`.
- `src/components/ui/field.tsx:40-60` — `useFieldControl(props)` hands a
  control the `Field`'s id and description ids. A control that renders many
  inputs must give each its own `id`, or every one inherits the same id.
- Dependencies: no `cmdk`, no `@radix-ui/react-popover` in `bun.lock`.
  This plan adds **no** dependency; the picker is the WAI-ARIA combobox
  pattern (input + inline listbox) in plain React, which is also what keeps
  it testable under happy-dom without a portal.
- `DESIGN.md` rules that bind here: "Use native controls with visible
  labels, helpers only when needed"; "Use Geist Mono only for code,
  commands, paths, raw tokens" (a setting value such as `acceptEdits` is a
  token: mono); no icon as decoration (one chevron on the trigger is an
  established affordance and stays); no em dash; `…` not `...`.
- Tests: `bun:test`, Testing Library, `userEvent`; hidden-field round trips
  via a `hiddenValue()` helper (`string-list.test.tsx:6-13`).

## Commands you will need

| Purpose                            | Command                                              | Expected on success              |
| ---------------------------------- | ---------------------------------------------------- | -------------------------------- |
| Route types (once, fresh worktree) | `bunx next typegen`                                  | `✓ Types generated successfully` |
| Typecheck                          | `bun run typecheck`                                  | exit 0                           |
| Lint                               | `bun run lint`                                       | exit 0                           |
| Tests                              | `bun test`                                           | `0 fail`                         |
| Catalog tests                      | `bun test src/lib/catalog`                           | all pass                         |
| Controls                           | `bun test src/components/settings src/components/ui` | all pass                         |
| Format                             | `bunx prettier --check <touched files>`              | exit 0                           |

## Scope

**In scope**:

- `src/components/ui/picker.tsx` (create), `picker.test.tsx` (create)
- `src/components/settings/controls/select.tsx`, `select.test.tsx`
- `src/components/settings/controls/combobox.tsx`, `combobox.test.tsx`
- `src/components/settings/controls/string-list.tsx`, `string-list.test.tsx`
- `src/components/settings/controls/index.ts`
- `src/components/settings/control-component.tsx`, `control-component.test.tsx` (create)
- `src/lib/catalog/types.ts`, `overrides.ts`, `catalog.test.ts`
- `src/lib/config/option-sources.ts`, `option-sources.test.ts`
- `src/components/settings/settings-list.tsx` (the `resolveOptions` helper only)
- `docs/settings-catalog.md`, `docs/PLAN.md`, `README.md` (one sentence each)
- `plans/README.md` (status row)

**Out of scope**:

- `src/lib/catalog/settings.data.json` — never hand-edited, and not
  regenerated here (ADR 0003: a regeneration is its own research pass).
- `src/components/settings/controls/switch.tsx` — On/Off is two values, not
  a set worth searching; it keeps the Radix `Select` (and plan 018's
  `placeholder="Not set"`).
- `src/components/ui/select.tsx` — still used by the switch and the scope switcher.
- `src/lib/config/validate.ts`, `value-form.ts` — unchanged; the fixes are
  in the catalog and the controls.
- `hooks-editor.tsx`, `permission-rules.tsx` — plan 024.
- Keys whose options live _inside_ an object value (`skillOverrides`'
  four states, `spellcheck.checker`, `voice.mode`, `sandbox.credentials.envVars[].mode`,
  `strictPluginOnlyCustomization`'s union): they need object editors, which
  is a separate decision. Recorded in the index.
- `httpHookAllowedEnvVars` — plan 023 gives it the environment-variable list.

## Git workflow

- Branch: `advisor/022-every-option-set-is-a-searchable-picker`, from `main` after 018.
- Commit per step; imperative sentence, no prefix.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: The `Picker` primitive

Create `src/components/ui/picker.tsx` (`"use client"`):

```tsx
export interface PickerOption {
  value: string;
  /** One line under the value in the list; the reference's words where there are any. */
  description?: string;
}

export interface PickerProps extends FieldControlProps {
  /** The committed value. Controlled: the owner holds it. */
  value: string;
  onValueChange: (value: string) => void;
  options: PickerOption[];
  /** `strict`: the value must be one of the options. `free`: any text is a value. */
  mode: "strict" | "free";
  /** When given, a hidden input of this name carries the committed value to the form. */
  name?: string;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
}
```

Structure and behaviour:

- A wrapper `<div className="relative">` holding an `<input>` with
  `role="combobox"`, `aria-expanded`, `aria-controls={listId}`,
  `aria-autocomplete="list"`, `aria-activedescendant` (the active option's
  id when the list is open), `autoComplete="off"`, `spellCheck={false}`,
  and `className={cn(controlClassName, "h-control-md pr-9 font-mono", className)}`.
  Take `id`/`aria-describedby`/`aria-invalid` through `useFieldControl`
  exactly as `Input` does (`src/components/ui/input.tsx`).
- A `<button type="button" tabIndex={-1} aria-label="Show options">` with a
  `ChevronDownIcon` (`lucide-react`, `size-4 text-gray-900`), absolutely
  positioned at the right of the input, `onMouseDown={(e) => e.preventDefault()}`
  (so the input keeps focus) and `onClick` toggling the list with all
  options shown.
- The list: `<ul role="listbox" id={listId}>` rendered only while open and
  when there is at least one option to show, `className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-medium bg-background-100 p-1 shadow-menu"`.
  Each `<li role="option" id={`${listId}-${index}`} aria-selected={option.value === value}>`
  with `data-active` on the keyboard-active one and
  `className="cursor-default rounded-base px-2 py-1.5 text-sm text-gray-1000 data-[active=true]:bg-gray-100"`,
  `onMouseDown={(e) => e.preventDefault()}` and `onClick={() => choose(option)}`.
  Inside: `<span className="font-mono">{option.value}</span>` and, when
  present, `<span className="block truncate text-gray-900">{option.description}</span>`.
- State: `text` (what the input shows; starts as `value`), `open`, `active`
  (index into the shown options), `typed` (false until the user edits, so
  opening via the chevron or ArrowDown lists every option; true after a
  keystroke, when the list is filtered).
- Filtering: shown options are all options when `!typed`, else those whose
  `value` or `description` contains every whitespace-separated term of
  `text`, case-insensitively (reuse `queryTerms` from
  `src/lib/config/setting-search.ts` if plan 021 has landed; otherwise
  inline the two lines).
- Keyboard on the input: `ArrowDown` opens (if closed) or moves `active`
  down, wrapping; `ArrowUp` the reverse; `Enter` while open chooses the
  active option and `preventDefault()`s so the form does not submit;
  `Escape` closes (strict mode also resets `text` to `value`); `Tab` closes.
- `choose(option)`: set `text` to `option.value`, call `onValueChange(option.value)`, close.
- `onChange` of the input: set `text`, `typed = true`, open; in `free`
  mode also `onValueChange(text)` (every keystroke is a value).
- `onBlur` in strict mode: if `text` equals an option's value ignoring case,
  commit that option (normalised spelling); if `text` is empty, commit `""`;
  otherwise revert `text` to `value`. In free mode, blur only closes.
- When `name` is given: `<input type="hidden" name={name} value={value} />`.
- `useEffect` syncing `text` when the `value` prop changes from outside
  (a parent reset), guarded so it does not fight typing: only when
  `!open`.

Create `picker.test.tsx` (render inside `<Field label="Effort">` for the
label tests; use a small stateful `Harness` component that owns `value`):

1. `is labelled by its field and shows the value` — `getByLabelText("Effort")`
   has role `combobox` and value `high`.
2. `lists every option on ArrowDown, with descriptions` — press ArrowDown:
   `getAllByRole("option")` has one per option; a description is in the document.
3. `filters as you type` — type `xh`: only `xhigh` remains an option.
4. `chooses with Enter and carries the value in the hidden field` — ArrowDown
   twice, Enter: hidden `input[name="value"]` has the chosen value; the list
   is closed; the form was not submitted (wrap in a `<form onSubmit={spy}>`,
   `spy` not called).
5. `strict mode reverts text that is not an option on blur` — type `nope`,
   `user.tab()`: the input shows the previous value; hidden field unchanged.
6. `strict mode accepts an option typed in another case` — type `XHIGH`, tab:
   hidden field `xhigh`, input shows `xhigh`.
7. `free mode keeps whatever is typed` — mode `free`, type `claude-opus-5`,
   tab: hidden field `claude-opus-5`.
8. `an empty value unsets in strict mode` — clear the input, tab: hidden field `""`.
9. `aria-activedescendant follows the arrow keys` — after ArrowDown, the
   attribute names the first option's id; after another, the second's.

**Verify**: `bun test src/components/ui/picker.test.tsx` → 9 pass;
`bun test src/app/design-tokens.test.ts` → all pass (the classes above are all tokens).

### Step 2: `SelectControl` and `ComboboxControl` on the picker

`select.tsx`: keep the export name and props (`value`, `enumValues`); hold
`useState(typeof value === "string" ? value : "")` and render
`<Picker name="value" mode="strict" options={enumValues.map((v) => ({ value: v }))} placeholder="Not set" …/>`.

`combobox.tsx`: props become `{ value: unknown; suggestions: string[] }`
(drop `optionSource`); render `<Picker name="value" mode="free" …/>`.

Rewrite both test files around behaviour: shows the value; lists the
options on ArrowDown; strict refuses free text / free accepts it; submits
under `name="value"` (`not.toBeNull()` on the hidden field — never
`toBeDefined()`).

**Verify**: `bun test src/components/settings/controls/select.test.tsx src/components/settings/controls/combobox.test.tsx` → all pass;
`grep -rn "datalist\|optionSource" src/components/settings/controls/combobox.tsx` → no matches.

### Step 3: `StringListControl` entries can pick

Add an optional prop `suggestions?: string[]`. When it is non-empty, each
entry renders `<Picker mode="free" value={entry} onValueChange={(v) => handleUpdateEntry(index, v)} options={…} id={`${baseId}-${index}`} aria-label={`Entry ${index + 1}`} className="flex-1" />`
instead of the `Input`; when it is empty, keep the `Input` but give it the
same `id`/`aria-label` (no two inputs in one `Field` may share an id). The
hidden JSON field is unchanged.

Add to `string-list.test.tsx`: `offers suggestions for each entry` — with
`suggestions={["fable", "opus"]}`, every entry has role `combobox`, and
ArrowDown on the first lists both; `every entry input has its own id` —
render three entries, collect `id`s, `new Set(ids).size === 3`.

**Verify**: `bun test src/components/settings/controls/string-list.test.tsx` → all pass.

### Step 4: Typed dispatch

Replace `CONTROL_REGISTRY` with a `switch` in `control-component.tsx`. Keep
the exported props interface. Shape:

```tsx
/** The list a control may offer: the machine's own when there is one, else the catalog's. */
function offered(
  definition: SettingDefinition,
  options: Partial<Record<OptionSource, string[]>>
): string[] {
  const local = definition.optionSource
    ? (options[definition.optionSource] ?? [])
    : [];
  if (local.length > 0) return local;
  if (definition.suggestions.length > 0) return definition.suggestions;
  return definition.enumValues;
}

export function ControlComponent({
  definition,
  value,
  options = {},
}: ControlComponentProps) {
  if (!definition) return <JsonControl value={value} />;
  switch (definition.control) {
    case "switch":
      return <SwitchControl value={value} />;
    case "select":
      return <SelectControl value={value} enumValues={definition.enumValues} />;
    case "combobox":
      return (
        <ComboboxControl
          value={value}
          suggestions={offered(definition, options)}
        />
      );
    case "text":
      return <TextControl value={value} />;
    case "number":
      return <NumberControl value={value} />;
    case "stringList":
      return (
        <StringListControl
          value={value}
          suggestions={offered(definition, options)}
        />
      );
    case "literalToggle":
      return (
        <LiteralToggleControl
          value={value}
          literal={definition.literal ?? ""}
        />
      );
    case "json":
      return <JsonControl value={value} />;
    case "permissionRules": {
      /* plan 018's list derivation, unchanged */
    }
    case "hooks":
      return <HooksEditorControl value={value} />;
  }
}
```

TypeScript's exhaustiveness on `Control` replaces the "unknown control →
JSON" fallback: a new `Control` member fails typecheck until it is handled.
In `controls/index.ts` delete `CONTROL_REGISTRY` and the `as unknown as`
casts; keep the named exports.

Create `control-component.test.tsx`, table-driven over every `Control`
value: for each, take the first entry of `SETTINGS` with that control (from
`@/lib/catalog`), render `<ControlComponent definition={entry} value={undefined} />`
and assert the expected role or field: `switch`/`select`/`combobox` → a
`combobox`; `text` → a `textbox`; `number` → a `spinbutton`; `stringList`,
`permissionRules`, `hooks` → a hidden `input[name="value"]`; `literalToggle`
→ a `checkbox`; `json` → a `textbox` with `font-mono`. Plus: no definition
→ JSON textbox; `combobox` prefers `options[optionSource]` over the
catalog's suggestions (render `model` with `options={{ models: ["claude-x"] }}`,
ArrowDown, the option `claude-x` is listed and `fable` is not); `stringList`
with an `optionSource` passes suggestions (render `fallbackModel` after step 5).

**Verify**: `bun run typecheck` 0 · `grep -rn "CONTROL_REGISTRY\|as unknown as" src/components/settings` → no matches ·
`bun test src/components/settings/control-component.test.tsx` → all pass.

### Step 5: Catalog fixes

In `types.ts`: `export type OptionSource = "models" | "outputStyles" | "themes" | "agents";`

In `overrides.ts`:

```ts
  fallbackModel: {
    note: "The reference types this as an array of aliases or IDs (`\"default\"` expands to the default model); each entry offers the model list.",
    control: "stringList",
    optionSource: "models",
    suggestions: ["default", "fable", "opus", "sonnet", "haiku"],
  },
  availableModels: {
    note: "An allowlist of model aliases or IDs; each entry offers the model list.",
    optionSource: "models",
    suggestions: ["fable", "opus", "sonnet", "haiku"],
  },
  teammateDefaultModel: {
    note: "Same value space as `model`.",
    control: "combobox",
    optionSource: "models",
    suggestions: ["fable", "opus", "sonnet", "haiku"],
  },
  theme: {
    note: 'Seven built-in names plus two open forms, `custom:<slug>` and `custom:<plugin>:<slug>`. The names are suggestions, not a closed set: an enumValues list here makes the validator refuse the custom forms.',
    control: "combobox",
    optionSource: "themes",
    enumValues: [],
    suggestions: ["auto", "dark", "light", "dark-daltonized", "light-daltonized", "dark-ansi", "light-ansi"],
  },
  agent: {
    note: "The reference types this as the name of a built-in or custom agent; names are offered from the agents on disk.",
    control: "combobox",
    optionSource: "agents",
  },
```

Move `agent` out of the "Keys that stay raw JSON" group into the first
group; keep the file's section comments accurate.

Add to `catalog.test.ts`:

- `array keys whose entries are models offer the model list` — `fallbackModel`
  and `availableModels` have `control === "stringList"` and `optionSource === "models"`.
- `theme accepts its custom forms` — `enumValues` is `[]`, `suggestions.length === 7`,
  and `validateSetting("custom:mine", getSetting("theme")!)` is ok (import
  `validateSetting` from `@/lib/config/validate`).
- `agent is a name, not an object` — control `combobox`, `optionSource === "agents"`, `valueType === "string"`.
- `a combobox or list with an option source has something to show when the machine has nothing` —
  every `SETTINGS` entry with `optionSource` set has `suggestions.length > 0`
  **or** `optionSource === "agents"` (agents have no sensible static fallback).

Also assert the earlier bug is gone by test, in `value-form.test.ts` if it is
convenient, or here: `parseValueForSetting('["opus"]', getSetting("fallbackModel"))` is ok.

**Verify**: `bun test src/lib/catalog` → all pass (including the existing
"every override names a documented key" guard).

### Step 6: The `agents` option source

In `option-sources.ts`, extend the signature:

```ts
export async function resolveOptionSource(
  source: OptionSource,
  homeDir: string = homedir(),
  projectRoot?: string
): Promise<string[]>;
```

For `"agents"`: read `join(homeDir, ".claude", "agents")` and, when
`projectRoot` is given, `join(projectRoot, ".claude", "agents")`; each
`*.md` yields its frontmatter `name:` or its file name (reuse `styleName`,
renamed to something neutral such as `frontmatterName`); return the sorted,
de-duplicated union. A missing directory yields nothing, as for styles.

In `settings-list.tsx`'s `resolveOptions()`, add `"agents"` to `sources` and
pass `location.projectRoot`: `resolveOptionSource(source, undefined, location.projectRoot)`.

Add to `option-sources.test.ts`: `names agents from the user and project directories`
— a temp home with `.claude/agents/reviewer.md` (frontmatter `name: Code reviewer`)
and a temp project with `.claude/agents/deployer.md` (no frontmatter):
result `["Code reviewer", "deployer"]`; and `offers no agents when neither directory exists`.

**Verify**: `bun test src/lib/config/option-sources.test.ts` → all pass;
`bun run typecheck` → 0.

### Step 7: Docs

- `README.md:31` — replace "with dropdowns where the key has enumerated
  values" with "with a searchable picker wherever the key has a known set of
  values".
- `docs/PLAN.md:68` — "any key with enumerated values gets a dropdown" →
  "any key with a known set of values gets a searchable picker; a closed set
  refuses other text, an open one offers the set and accepts anything".
- `docs/settings-catalog.md`, "Enumerated values" paragraph — replace "get a
  dropdown" with "get a strict picker" and "get a combobox" with "get a free
  picker", and append one sentence: "`theme`'s seven names are suggestions
  in the catalog, not `enumValues`, because the validator treats `enumValues`
  as closed and the custom forms must pass."

**Verify**: `grep -n "searchable picker" README.md docs/PLAN.md` → 2 matches.

### Step 8: Gates, manual check, index

`bun run typecheck` 0 · `bun run lint` 0 · `bun test` 0 fail · prettier
check on touched files 0. Manual (`bun dev`): on `/settings` expand
`permissions.defaultMode`, type `acc`, pick `acceptEdits` with Enter — the
form does not submit on that Enter; Save writes it (through the confirm
dialog, it is dangerous). Expand `fallbackModel`: entries offer the model
list; Save with `["opus"]` succeeds. Expand `theme`: type `custom:mine`,
Save succeeds. Restore your scratch changes from History. Update the index row.

## Test plan

Steps 1–6 each carry their tests; the table-driven `control-component.test.tsx`
is the one that protects every key at once. Patterns: `string-list.test.tsx`
for hidden-field assertions, `ui/select.test.tsx` for `Field`-label queries,
`option-sources.test.ts` for temp-directory fixtures.

## Done criteria

- [ ] `bun run typecheck`, `bun run lint`, `bun test` exit 0
- [ ] `src/components/ui/picker.tsx` exists; `bun test src/components/ui/picker.test.tsx` → 9 pass
- [ ] `grep -rn "CONTROL_REGISTRY\|as unknown as" src/components/settings` → no matches
- [ ] `grep -rn "datalist" src/components` → no matches
- [ ] `grep -c "react-popover\|cmdk" package.json` → 0 (no new dependency)
- [ ] `bun -e 'const vf = await import("./src/lib/config/value-form.ts"); const v = await import("./src/lib/config/validate.ts"); const c = await import("./src/lib/catalog/index.ts"); console.log(vf.parseValueForSetting("[\"opus\"]", c.getSetting("fallbackModel")).ok, v.validateSetting("custom:mine", c.getSetting("theme")).ok, c.getSetting("agent").control)'` prints `true true combobox`
- [ ] `bun test src/app/design-tokens.test.ts` → all pass
- [ ] `git status --short` shows nothing outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

- `settings.data.json` no longer says `fallbackModel` is an array, `agent`
  is a string, or `theme`'s Type line has changed — the reference moved;
  report before changing overrides.
- The picker's tests need a portal, `ResizeObserver`, or `scrollIntoView`
  to pass under happy-dom — the design above needs none of them; if you find
  yourself adding one, stop and report.
- You are tempted to add `cmdk` or a Radix popover. Do not; report why the
  plain pattern is insufficient instead.
- The exhaustive `switch` in step 4 reveals a `Control` value with no
  component (there should be exactly ten).
- A step's verification fails twice.

## Maintenance notes

- Plan 023 adds a fifth option source (`envVars`, from the environment
  variable catalog) and uses `Picker` with descriptions; it assumes the
  `PickerOption.description` field and the `offered()` helper.
- Per-value descriptions for enumerated keys (`low`: …, `high`: …) exist in
  the reference's Type sub-bullets but are not persisted by
  `scripts/extract-settings-reference.ts`. Persisting them is a catalog
  regeneration (ADR 0003) — recorded in the index as a follow-up.
- If a future key needs a closed set _and_ a machine-local list, `offered()`
  already prefers the local list; keep `enumValues` empty for such keys or
  the validator will refuse local values.
- Reviewer focus: the strict-mode blur rules (revert vs accept), the
  `Enter`-does-not-submit guard, and that no control inside a `Field` shares
  an id with another.
