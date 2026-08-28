import type { Control } from "@/lib/catalog";
import { SwitchControl } from "./switch";
import { SelectControl } from "./select";
import { ComboboxControl } from "./combobox";
import { TextControl } from "./text";
import { NumberControl } from "./number";
import { StringListControl } from "./string-list";
import { LiteralToggleControl } from "./literal-toggle";
import { JsonControl } from "./json";
import { PermissionRulesControl } from "./permission-rules";
import { HooksEditorControl } from "./hooks-editor";
import type { ComponentType } from "react";

export {
  SwitchControl,
  SelectControl,
  ComboboxControl,
  TextControl,
  NumberControl,
  StringListControl,
  LiteralToggleControl,
  JsonControl,
  PermissionRulesControl,
  HooksEditorControl,
};

/**
 * Registry of control components keyed by control type.
 * When a component is not listed, it falls back to JsonControl.
 */
export const CONTROL_REGISTRY: Record<
  Control,
  ComponentType<Record<string, unknown>>
> = {
  switch: SwitchControl as unknown as ComponentType<Record<string, unknown>>,
  select: SelectControl as unknown as ComponentType<Record<string, unknown>>,
  combobox: ComboboxControl as unknown as ComponentType<
    Record<string, unknown>
  >,
  text: TextControl as unknown as ComponentType<Record<string, unknown>>,
  number: NumberControl as unknown as ComponentType<Record<string, unknown>>,
  stringList: StringListControl as unknown as ComponentType<
    Record<string, unknown>
  >,
  literalToggle: LiteralToggleControl as unknown as ComponentType<
    Record<string, unknown>
  >,
  json: JsonControl as unknown as ComponentType<Record<string, unknown>>,
  permissionRules: PermissionRulesControl as unknown as ComponentType<
    Record<string, unknown>
  >,
  hooks: HooksEditorControl as unknown as ComponentType<
    Record<string, unknown>
  >,
};
