"use client";

import {
  ComboboxControl,
  HooksEditorControl,
  JsonControl,
  LiteralToggleControl,
  NumberControl,
  PermissionRulesControl,
  SelectControl,
  StringListControl,
  SwitchControl,
  TextControl,
} from "./controls";
import type { OptionSource, SettingDefinition } from "@/lib/catalog";
import type { PickerOption } from "@/components/ui/picker";

export interface ControlComponentProps {
  definition?: SettingDefinition;
  value: unknown;
  /** Machine-local option lists, resolved on the server when the page rendered. */
  options?: Partial<Record<OptionSource, PickerOption[]>>;
}

/** The list a control may offer: the machine's own when there is one, else the catalog's. */
function offered(
  definition: SettingDefinition,
  options: Partial<Record<OptionSource, PickerOption[]>>
): PickerOption[] {
  const local = definition.optionSource
    ? (options[definition.optionSource] ?? [])
    : [];
  if (local.length > 0) return local;
  if (definition.suggestions.length > 0)
    return definition.suggestions.map((value) => ({ value }));
  return definition.enumValues.map((value) => ({ value }));
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
      const list = definition.key.split(".")[1];
      if (list === "allow" || list === "ask" || list === "deny") {
        return <PermissionRulesControl value={value} list={list} />;
      }
      return <JsonControl value={value} />;
    }
    case "hooks":
      return <HooksEditorControl value={value} />;
  }
}
