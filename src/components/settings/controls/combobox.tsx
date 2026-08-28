"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";

export interface ComboboxControlProps {
  value: unknown;
  suggestions?: string[];
  optionSource?: string;
}

export function ComboboxControl({
  value,
  suggestions = [],
  optionSource,
}: ComboboxControlProps) {
  const listId = useId();

  return (
    <>
      <Input
        name="value"
        list={listId}
        defaultValue={typeof value === "string" ? value : ""}
        placeholder={
          optionSource ? `Resolved from ${optionSource}...` : undefined
        }
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      )}
    </>
  );
}
