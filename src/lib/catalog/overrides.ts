import type { SettingOverride } from "./types";

/**
 * Corrections and interface hints layered over the extracted reference data.
 *
 * The extractor reads quoted string literals out of each key's Type line, which is right most
 * of the time and wrong in three recurring ways: prose that offers examples rather than a
 * closed set, keys whose only legal value is one fixed string, and keys whose real options
 * exist only on this machine. Everything here is a deliberate reading of the documentation,
 * with the reasoning kept in `note` so a later reader can check it against the docs.
 */
export const OVERRIDES: Record<string, SettingOverride> = {
  // --- Extracted values were examples, not a closed set ------------------------------------

  language: {
    note: 'Docs: "any language name ... Claude Code doesn\'t validate it". The three quoted names are examples.',
    control: "combobox",
    enumValues: [],
    suggestions: ["japanese", "spanish", "french", "german", "portuguese", "korean", "chinese"],
  },
  advisorModel: {
    note: "Aliases resolve to a family's current default, but a full model ID is equally valid, so this cannot be a closed list.",
    control: "combobox",
    enumValues: [],
    suggestions: ["fable", "opus", "sonnet"],
    optionSource: "models",
  },
  model: {
    note: "Free string: an alias or a full model ID. Suggestions come from the machine where possible.",
    control: "combobox",
    optionSource: "models",
    suggestions: ["fable", "opus", "sonnet", "haiku"],
  },
  fallbackModel: {
    note: "Same value space as `model`.",
    control: "combobox",
    optionSource: "models",
    suggestions: ["fable", "opus", "sonnet", "haiku"],
  },
  outputStyle: {
    note: "The name of a built-in or custom output style; custom ones live on disk, so the list is machine-specific.",
    control: "combobox",
    optionSource: "outputStyles",
  },
  theme: {
    note: 'Closed set plus two open-ended forms, `custom:<slug>` and `custom:<plugin>:<slug>`, which are patterns rather than values.',
    control: "combobox",
    optionSource: "themes",
    enumValues: [
      "auto",
      "dark",
      "light",
      "dark-daltonized",
      "light-daltonized",
      "dark-ansi",
      "light-ansi",
    ],
  },

  // --- Present-as-one-fixed-string keys -----------------------------------------------------

  disableAutoMode: {
    note: 'Docs: "the string `\\"disable\\"`". Absent means enabled; there is no `false`.',
    control: "literalToggle",
    valueType: "string",
    literal: "disable",
  },
  disableDeepLinkRegistration: {
    note: "Same shape as `disableAutoMode`: the string \"disable\", or absent.",
    control: "literalToggle",
    valueType: "string",
    literal: "disable",
  },
  "permissions.disableBypassPermissionsMode": {
    note: "Same shape: the string \"disable\", or absent.",
    control: "literalToggle",
    valueType: "string",
    literal: "disable",
  },
  browserExternalPageTools: {
    note: 'Docs: string `"disabled"`, with the desktop app also accepting `"disable"`. Prefer the documented spelling.',
    control: "literalToggle",
    valueType: "string",
    literal: "disabled",
  },

  // --- Union types the Type line states in prose --------------------------------------------

  strictPluginOnlyCustomization: {
    note: '`true` locks all four kinds, or an array naming them. A union of Boolean and array, so neither control fits; edited as JSON.',
    control: "json",
    valueType: "unknown",
    dangerous: true,
  },
  "strictPluginOnlyCustomization.skills": {
    note: "Documents a member of the parent array, not a settable key.",
    virtual: true,
  },
  "strictPluginOnlyCustomization.agents": { note: "Array member, not a settable key.", virtual: true },
  "strictPluginOnlyCustomization.hooks": { note: "Array member, not a settable key.", virtual: true },
  "strictPluginOnlyCustomization.mcp": { note: "Array member, not a settable key.", virtual: true },

  // --- Keys with purpose-built editors -------------------------------------------------------

  "permissions.allow": {
    note: "Permission rules have their own syntax and a typo silently changes what Claude Code will do unprompted.",
    control: "permissionRules",
  },
  "permissions.ask": { note: "See `permissions.allow`.", control: "permissionRules" },
  "permissions.deny": { note: "See `permissions.allow`.", control: "permissionRules" },
  hooks: {
    note: "Structured, event-keyed, and executes shell commands. Warrants its own editor and a confirmation.",
    control: "hooks",
    dangerous: true,
  },

  // --- Keys that stay raw JSON until they earn more -------------------------------------------

  permissions: { note: "Container for the permission sub-keys; not edited as a whole.", virtual: true },
  sandbox: { note: "Container for the sandbox sub-keys; not edited as a whole.", virtual: true },
  env: { note: "An open map of environment variables; no schema to render.", control: "json" },
  pluginConfigs: { note: "Per-plugin shape is plugin-defined and undocumented.", control: "json" },
  statusLine: { note: "Object with a command plus optional numeric fields; runs a shell command.", control: "json", dangerous: true },
  modelPicker: { note: "Object with documented sub-fields; treated as JSON until the fields are catalogued.", control: "json" },
  agent: { note: "Object describing a subagent: prompt, tools, and model.", control: "json" },
  attribution: { note: "Container for the attribution sub-keys.", virtual: true },
  worktree: { note: "Container for the worktree sub-keys.", virtual: true },
  autoMode: { note: "Container: its own rules plus sub-keys.", control: "json" },

  // --- Dangerous enough to confirm ------------------------------------------------------------

  apiKeyHelper: { note: "Runs a command of the user's choosing to produce credentials.", dangerous: true },
  awsAuthRefresh: { note: "Runs a command to refresh credentials.", dangerous: true },
  "permissions.defaultMode": { note: "Directly governs what Claude Code will do without asking.", dangerous: true },
  disableAllHooks: { note: "Turns off every hook, including ones relied on for safety.", dangerous: true },
};
