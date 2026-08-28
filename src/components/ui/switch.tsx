"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";
import { useFieldControl } from "./field";

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  const fieldProps = useFieldControl(props);
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent",
        "bg-gray-500 transition-colors outline-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900",
        "data-[state=checked]:bg-blue-700",
        "disabled:cursor-not-allowed disabled:bg-gray-300",
        className,
      )}
      {...fieldProps}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-background-100 shadow-small",
          "transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
