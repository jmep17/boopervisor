"use client";

import { Textarea } from "@/components/ui/textarea";

export interface JsonControlProps {
  value: unknown;
}

export function JsonControl({ value }: JsonControlProps) {
  let text = "";
  if (value !== undefined) {
    text = JSON.stringify(value, null, 2);
  }

  return (
    <Textarea
      name="value"
      defaultValue={text}
      placeholder='{"key": "value"}'
      className="font-mono text-sm"
    />
  );
}
