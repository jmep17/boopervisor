import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  cn(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-base",
    "font-medium transition-colors outline-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900",
    "disabled:pointer-events-none disabled:bg-gray-100 disabled:text-gray-700",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        primary: "bg-gray-1000 text-background-100 hover:bg-gray-900",
        secondary:
          "border border-gray-400 bg-background-100 text-gray-1000 hover:border-gray-500 hover:bg-gray-100",
        ghost: "text-gray-900 hover:bg-gray-alpha-100 hover:text-gray-1000",
        danger: "bg-red-800 text-white hover:bg-red-900",
      },
      size: {
        sm: "h-control-sm px-2.5 text-sm",
        md: "h-control-md px-3 text-sm",
        lg: "h-control-lg px-4 text-base",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  /** Render the child element instead of a `button`, keeping the styling. */
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
