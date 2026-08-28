"use client";

import { Input } from "@/components/ui/input";

export interface TextControlProps {
  value: unknown;
}

export function TextControl({ value }: TextControlProps) {
  return (
    <Input name="value" defaultValue={typeof value === "string" ? value : ""} />
  );
}
