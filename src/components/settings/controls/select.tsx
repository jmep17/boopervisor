"use client";

import { Select, SelectItem } from "@/components/ui/select";

export interface SelectControlProps {
  value: unknown;
  enumValues: string[];
}

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
