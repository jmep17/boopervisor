import data from "./settings.data.json";
import { OVERRIDES } from "./overrides";
import type { Control, ExtractedSetting, SettingDefinition, Scope, ValueType } from "./types";

export * from "./types";
export * from "./hooks";
export { OVERRIDES } from "./overrides";

export const CATALOG_SOURCE = data.source;
export const CATALOG_EXTRACTED_AT = data.extractedAt;

const extracted = data.settings as ExtractedSetting[];

/** The control a key gets when no override names one. */
function defaultControl(valueType: ValueType, enumValues: string[]): Control {
  if (valueType === "boolean") return "switch";
  if (valueType === "number") return "number";
  if (valueType === "array") return "stringList";
  if (valueType === "object") return "json";
  if (valueType === "string") return enumValues.length > 1 ? "select" : "text";
  return "json";
}

function define(entry: ExtractedSetting): SettingDefinition {
  const override = OVERRIDES[entry.key];
  const valueType = override?.valueType ?? entry.valueType;
  const enumValues = override?.enumValues ?? entry.enumValues;
  return {
    ...entry,
    valueType,
    enumValues,
    control: override?.control ?? defaultControl(valueType, enumValues),
    suggestions: override?.suggestions ?? [],
    optionSource: override?.optionSource,
    literal: override?.literal,
    virtual: override?.virtual ?? false,
    dangerous: override?.dangerous ?? false,
    overrideNote: override?.note,
  };
}

/** Every documented key, including the ones the interface hides. Sorted by key. */
export const ALL_SETTINGS: SettingDefinition[] = extracted.map(define);

/** The keys the settings interface renders: everything that is actually settable on its own. */
export const SETTINGS: SettingDefinition[] = ALL_SETTINGS.filter((s) => !s.virtual);

const BY_KEY = new Map(ALL_SETTINGS.map((s) => [s.key, s]));

export function getSetting(key: string): SettingDefinition | undefined {
  return BY_KEY.get(key);
}

/** True when a key found on disk is not described by the catalog. See ADR 0003. */
export function isUncatalogued(key: string): boolean {
  return !BY_KEY.has(key);
}

export function settingsForScope(scope: Scope): SettingDefinition[] {
  return SETTINGS.filter((s) => s.scopes.includes(scope));
}

/** Topics in the order the reference presents them, each with its settable keys. */
export function settingsByTopic(): { topic: string; settings: SettingDefinition[] }[] {
  const topics = new Map<string, SettingDefinition[]>();
  for (const setting of SETTINGS) {
    const list = topics.get(setting.topic);
    if (list) list.push(setting);
    else topics.set(setting.topic, [setting]);
  }
  return [...topics].map(([topic, settings]) => ({ topic, settings }));
}

/**
 * Overrides naming a key the reference no longer documents. A regenerated
 * `settings.data.json` can silently strand an override; the catalog test fails on this.
 */
export function orphanedOverrides(): string[] {
  return Object.keys(OVERRIDES).filter((key) => !BY_KEY.has(key));
}
