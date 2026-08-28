"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon, MinusIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";
import { useFieldControl } from "./field";

export function Checkbox({
  className,
  ...props
}: ComponentProps<typeof CheckboxPrimitive.Root>) {
  const fieldProps = useFieldControl(props);
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-base border border-gray-500 bg-background-100",
        "transition-colors outline-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900",
        "data-[state=checked]:border-blue-700 data-[state=checked]:bg-blue-700",
        "data-[state=indeterminate]:border-blue-700 data-[state=indeterminate]:bg-blue-700",
        "disabled:cursor-not-allowed disabled:border-gray-400 disabled:bg-gray-100",
        "aria-invalid:border-red-800",
        className,
      )}
      {...fieldProps}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
        {props.checked === "indeterminate" ? (
          <MinusIcon className="size-3" />
        ) : (
          <CheckIcon className="size-3" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
