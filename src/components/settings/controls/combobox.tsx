"use client";

import { useState } from "react";

import { Picker } from "@/components/ui/picker";

export interface ComboboxControlProps {
  value: unknown;
  suggestions: string[];
}

export function ComboboxControl({ value, suggestions }: ComboboxControlProps) {
  const [selected, setSelected] = useState(
    typeof value === "string" ? value : ""
  );

  return (
    <Picker
      name="value"
      mode="free"
      value={selected}
      onValueChange={setSelected}
      options={suggestions.map((suggestion) => ({ value: suggestion }))}
    />
  );
}
