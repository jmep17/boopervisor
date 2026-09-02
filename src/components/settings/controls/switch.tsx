"use client";

import { Select, SelectItem } from "@/components/ui/select";

export interface SwitchControlProps {
  value: unknown;
}

export function SwitchControl({ value }: SwitchControlProps) {
  return (
    <Select
      name="value"
      placeholder="Not set"
      defaultValue={value === undefined ? "" : String(Boolean(value))}
    >
      <SelectItem value="true">On</SelectItem>
      <SelectItem value="false">Off</SelectItem>
    </Select>
  );
}
