"use client";

import { useId, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";

export interface LiteralToggleControlProps {
  value: unknown;
  literal?: string;
}

export function LiteralToggleControl({
  value,
  literal = "on",
}: LiteralToggleControlProps) {
  const isSet = value === literal;
  const [checked, setChecked] = useState(isSet);
  const inputId = useId();

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={inputId}
        defaultChecked={isSet}
        onCheckedChange={(c) => setChecked(Boolean(c))}
      />
      <input type="hidden" name="value" value={checked ? "on" : ""} />
      <label htmlFor={inputId} className="text-sm text-gray-1000">
        {literal}
      </label>
    </div>
  );
}
