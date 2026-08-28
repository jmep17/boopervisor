"use client";

import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";
import { controlClassName } from "./control";
import { useFieldControl } from "./field";

export function Input({ className, ...props }: ComponentProps<"input">) {
  const fieldProps = useFieldControl(props);
  return (
    <input
      data-slot="input"
      className={cn(controlClassName, "h-control-md", className)}
      {...fieldProps}
    />
  );
}
