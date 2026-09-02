"use client";

import { useState } from "react";

import { Picker } from "@/components/ui/picker";

export interface SelectControlProps {
  value: unknown;
  enumValues: string[];
}

export function SelectControl({ value, enumValues }: SelectControlProps) {
  const [selected, setSelected] = useState(
    typeof value === "string" ? value : ""
  );

  return (
    <Picker
      name="value"
      mode="strict"
      value={selected}
      onValueChange={setSelected}
      options={enumValues.map((allowed) => ({ value: allowed }))}
      placeholder="Not set"
    />
  );
}
