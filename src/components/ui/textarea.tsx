"use client";

import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";
import { controlClassName } from "./control";
import { useFieldControl } from "./field";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  const fieldProps = useFieldControl(props);
  return (
    <textarea
      data-slot="textarea"
      className={cn(controlClassName, "min-h-24 py-2 font-mono leading-relaxed", className)}
      {...fieldProps}
    />
  );
}
