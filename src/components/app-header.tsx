"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { buttonVariants } from "./ui/button";

export const NAV_ITEMS = [
  { href: "/settings", label: "Settings" },
  { href: "/skills", label: "Skills" },
  { href: "/plugins", label: "Plugins" },
  { href: "/mcp", label: "MCP" },
  { href: "/history", label: "History" },
] as const;

function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The route list, given the path rather than reading it, so it can be rendered alone. */
export function AppHeaderNav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Sections" className="flex items-center gap-1">
      {NAV_ITEMS.map((item) => {
        const current = isCurrent(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              buttonVariants({
                variant: current ? "secondary" : "ghost",
                size: "sm",
              }),
              current && "text-gray-1000"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** `scopeSwitcher` is rendered by the server layout, which reads the selection. */
export function AppHeader({ scopeSwitcher }: { scopeSwitcher?: ReactNode }) {
  const pathname = usePathname();
  return (
    <header className="border-b border-gray-400 bg-background-100">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-6">
        <Link
          href="/settings"
          className="text-sm font-semibold tracking-tight text-gray-1000"
        >
          Boopervisor
        </Link>
        <AppHeaderNav pathname={pathname} />
        <div className="ml-auto">{scopeSwitcher}</div>
      </div>
    </header>
  );
}
