/** Which settings file a key may appear in. */
export type Scope = "user" | "project" | "local" | "managed" | "globalConfig";

/** Precedence, highest first. `globalConfig` is ~/.claude.json and is not part of the merge. */
export const PRECEDENCE: readonly Scope[] = ["managed", "local", "project", "user"] as const;

export const SCOPE_FILES: Record<Scope, string> = {
  user: "~/.claude/settings.json",
  project: ".claude/settings.json",
  local: ".claude/settings.local.json",
  managed: "managed-settings.json",
  globalConfig: "~/.claude.json",
};

/** The value shape a key holds, as derived from the reference's Type line. */
export type ValueType = "boolean" | "string" | "number" | "array" | "object" | "unknown";

/** Which control the interface renders for a key. */
export type Control =
  | "switch" // Boolean
  | "select" // string with a closed set of allowed values
  | "combobox" // string with suggested values but free entry
  | "text" // free string
  | "number"
  | "stringList" // array of strings
  | "literalToggle" // present as one fixed string, or absent
  | "permissionRules" // permissions.allow / ask / deny
  | "hooks"
  | "json"; // structured and syntax-heavy; edited as validated JSON

/** Option lists that only exist on the user's machine, resolved at render time. */
export type OptionSource = "models" | "outputStyles" | "themes";

/** One entry as extracted from the published reference. Regenerated, never hand-edited. */
export type ExtractedSetting = {
  key: string;
  topic: string;
  summary: string;
  scopes: Scope[];
  valueType: ValueType;
  enumValues: string[];
  typeText: string;
  defaultText: string;
  perSessionOverrides: string;
  docUrl: string;
};

/** Hand-maintained corrections and interface hints. See ADR 0003. */
export type SettingOverride = {
  /** Why this override exists. Required: an unexplained override is indistinguishable from a bug. */
  note: string;
  control?: Control;
  valueType?: ValueType;
  /** Replaces the extracted list. Empty means the extracted values were examples, not a closed set. */
  enumValues?: string[];
  /** Offered in a combobox without constraining what can be typed. */
  suggestions?: string[];
  optionSource?: OptionSource;
  /** The single string a literalToggle writes when on. */
  literal?: string;
  /**
   * Documented for reference but not settable on its own — it describes a member of another
   * key's value. Hidden from the settings interface.
   */
  virtual?: boolean;
  /** Warrants a confirmation step before writing. */
  dangerous?: boolean;
};

/** An extracted entry with its override applied. What the interface actually renders. */
export type SettingDefinition = ExtractedSetting & {
  control: Control;
  suggestions: string[];
  optionSource?: OptionSource;
  literal?: string;
  virtual: boolean;
  dangerous: boolean;
  overrideNote?: string;
};
