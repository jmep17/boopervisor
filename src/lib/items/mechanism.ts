import type { Scope } from "@/lib/catalog";
import type {
  EffectiveValue,
  SettingsResolution,
} from "@/lib/config/effective";
import type { ItemType } from "./item-state";

/**
 * How Claude Code itself disables one kind of item. Every item type has one: Boopervisor
 * never invents a mechanism, and never disables an item by editing its own configuration.
 *
 * Each is a settings key, so disabling merges by precedence like any other setting and a
 * higher scope can decide a state the edited scope cannot undo.
 */
export interface DisablingMechanism {
  /** The settings key that decides it. */
  key: string;
  /** Whether that key's effective value disables this item. */
  disables(value: unknown, name: string): boolean;
  /** The key's next value with the item disabled, given what the edited scope holds now. */
  disable(current: unknown, name: string): unknown;
  /** The same, enabling it. `undefined` unsets the key. */
  enable(current: unknown, name: string): unknown;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** An empty list says nothing, so it is removed rather than written. */
function orUnset(list: unknown[]): unknown[] | undefined {
  return list.length > 0 ? list : undefined;
}

/** A server named in `deniedMcpServers`, which is `[{ serverName }]`. */
const DENIED_MCP: DisablingMechanism = {
  key: "deniedMcpServers",
  disables: (value, name) =>
    asArray(value).some((entry) => asObject(entry).serverName === name),
  disable: (current, name) =>
    DENIED_MCP.disables(current, name)
      ? current
      : [...asArray(current), { serverName: name }],
  enable: (current, name) =>
    orUnset(
      asArray(current).filter((entry) => asObject(entry).serverName !== name)
    ),
};

/** A server named in `disabledMcpjsonServers`, which is a list of names from `.mcp.json`. */
const DISABLED_MCPJSON: DisablingMechanism = {
  key: "disabledMcpjsonServers",
  disables: (value, name) => asArray(value).includes(name),
  disable: (current, name) =>
    asArray(current).includes(name) ? current : [...asArray(current), name],
  enable: (current, name) =>
    orUnset(asArray(current).filter((entry) => entry !== name)),
};

/** A skill turned off in `skillOverrides`, which maps a skill's name to how it is treated. */
const SKILL_OVERRIDES: DisablingMechanism = {
  key: "skillOverrides",
  disables: (value, name) => asObject(value)[name] === "off",
  disable: (current, name) => ({ ...asObject(current), [name]: "off" }),
  enable: (current, name) => {
    const next = { ...asObject(current) };
    delete next[name];
    return Object.keys(next).length > 0 ? next : undefined;
  },
};

/** A plugin set to false in `enabledPlugins`, which maps `name@marketplace` to a boolean. */
const ENABLED_PLUGINS: DisablingMechanism = {
  key: "enabledPlugins",
  disables: (value, name) => asObject(value)[name] === false,
  disable: (current, name) => ({ ...asObject(current), [name]: false }),
  enable: (current, name) => {
    const next = { ...asObject(current) };
    delete next[name];
    return Object.keys(next).length > 0 ? next : undefined;
  },
};

/**
 * MCP servers are disabled differently depending on where they came from: a user-scope
 * server by name, a project's `.mcp.json` server by the key Claude Code has for exactly that.
 */
export function mechanismFor(type: ItemType, scope: Scope): DisablingMechanism {
  if (type === "skill") return SKILL_OVERRIDES;
  if (type === "plugin") return ENABLED_PLUGINS;
  return scope === "user" ? DENIED_MCP : DISABLED_MCPJSON;
}

/** The key's effective value and which scope supplied it, or nothing when it is unset. */
function effective(
  resolution: SettingsResolution,
  key: string
): EffectiveValue | undefined {
  return resolution.effectiveValues.find((value) => value.key === key);
}

export function isDisabledBySettings(
  type: ItemType,
  name: string,
  scope: Scope,
  resolution: SettingsResolution
): boolean {
  const mechanism = mechanismFor(type, scope);
  return mechanism.disables(
    effective(resolution, mechanism.key)?.effectiveValue,
    name
  );
}

/**
 * The scope whose settings disable the item, or nothing when nothing does. A scope of
 * higher precedence than the one being edited is one the interface cannot undo.
 */
export function whyDisabled(
  type: ItemType,
  name: string,
  scope: Scope,
  resolution: SettingsResolution
): Scope | undefined {
  const mechanism = mechanismFor(type, scope);
  const value = effective(resolution, mechanism.key);
  return value && mechanism.disables(value.effectiveValue, name)
    ? value.winningScope
    : undefined;
}
