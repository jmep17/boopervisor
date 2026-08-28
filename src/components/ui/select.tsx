"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";
import { controlClassName } from "./control";
import { useFieldControl, type FieldControlProps } from "./field";

export interface SelectProps extends ComponentProps<typeof SelectPrimitive.Root> {
  /** Shown while nothing is chosen. */
  placeholder?: string;
  className?: string;
  children: ReactNode;
}

/**
 * A dropdown over a closed set of values. The trigger, popover and viewport are
 * assembled here because every use in Boopervisor wants the same three.
 */
export function Select({ placeholder, className, children, ...props }: SelectProps) {
  const triggerProps = useFieldControl<FieldControlProps>({});

  return (
    <SelectPrimitive.Root {...props}>
      <SelectPrimitive.Trigger
        data-slot="select-trigger"
        className={cn(
          controlClassName,
          "h-control-md flex items-center justify-between gap-2 text-left",
          "data-[placeholder]:text-gray-700",
          className,
        )}
        {...triggerProps}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDownIcon className="size-4 shrink-0 text-gray-900" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          data-slot="select-content"
          position="popper"
          sideOffset={4}
          className={cn(
            "relative z-50 max-h-64 min-w-[var(--radix-select-trigger-width)] overflow-hidden",
            "rounded-medium bg-background-100 p-1 shadow-menu",
          )}
        >
          <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex cursor-default select-none items-center justify-between gap-2",
        "rounded-base py-1.5 pl-2 pr-2 text-sm text-gray-1000 outline-none",
        "data-[highlighted]:bg-gray-100",
        "data-[disabled]:pointer-events-none data-[disabled]:text-gray-700",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator>
        <CheckIcon className="size-4 text-gray-1000" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
