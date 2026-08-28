import type { Scope } from "@/lib/catalog";

/** In precedence order, highest first, which is how every breakdown lists them. */
export const SCOPE_LABELS: Record<Scope, string> = {
  managed: "Managed",
  local: "Project-local",
  project: "Project",
  user: "User",
  globalConfig: "Global config",
};
