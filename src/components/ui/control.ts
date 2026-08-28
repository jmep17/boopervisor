import { cn } from "@/lib/cn";

/** The shared skin for anything that takes a value: input, textarea, select. */
export const controlClassName = cn(
  "w-full rounded-base border border-gray-400 bg-background-100 px-3 text-sm text-gray-1000",
  "transition-colors outline-none placeholder:text-gray-700",
  "hover:border-gray-500",
  "focus-visible:border-gray-1000 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900",
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-700",
  "aria-invalid:border-red-800 aria-invalid:focus-visible:outline-red-800",
);
