import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-base px-1.5 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-gray-200 text-gray-1000",
        info: "bg-blue-200 text-blue-900",
        warning: "bg-amber-200 text-amber-900",
        error: "bg-red-200 text-red-900",
        success: "bg-green-200 text-green-900",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />
  );
}
