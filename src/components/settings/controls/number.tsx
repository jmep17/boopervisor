"use client";

import { Input } from "@/components/ui/input";

export interface NumberControlProps {
  value: unknown;
}

export function NumberControl({ value }: NumberControlProps) {
  return (
    <Input
      name="value"
      type="number"
      defaultValue={typeof value === "number" ? String(value) : ""}
    />
  );
}
