"use client";

import { CONTROL_REGISTRY } from "./controls";
import type { OptionSource, SettingDefinition } from "@/lib/catalog";

export interface ControlComponentProps {
  definition?: SettingDefinition;
  value: unknown;
  /** Machine-local option lists, resolved on the server when the page rendered. */
  options?: Partial<Record<OptionSource, string[]>>;
}

/**
 * Renders the appropriate control for a setting definition.
 * Option source resolution happens server-side; this component uses pre-resolved options.
 */
export function ControlComponent({
  definition,
  value,
  options = {},
}: ControlComponentProps) {
  if (!definition) {
    // Uncatalogued keys fall back to JSON editor
    const JsonControl = CONTROL_REGISTRY.json;
    return <JsonControl value={value} />;
  }

  const SelectedControl = CONTROL_REGISTRY[definition.control];
  if (!SelectedControl) {
    // Fallback to JSON editor if control not found
    const JsonControl = CONTROL_REGISTRY.json;
    return <JsonControl value={value} />;
  }

  // Build props based on control type
  const controlProps: Record<string, unknown> = { value };

  if (definition.control === "select") {
    controlProps.enumValues = definition.enumValues;
  }

  if (definition.control === "combobox") {
    // A machine-local list when there is one, the catalog's suggestions when there is not.
    const local = definition.optionSource
      ? (options[definition.optionSource] ?? [])
      : [];
    controlProps.suggestions =
      local.length > 0 ? local : definition.suggestions;
  }

  if (definition.control === "literalToggle") {
    controlProps.literal = definition.literal ?? "";
  }

  if (definition.control === "permissionRules") {
    const list = definition.key.split(".")[1];
    if (list === "allow" || list === "ask" || list === "deny") {
      controlProps.list = list;
    }
  }

  return <SelectedControl {...controlProps} />;
}
