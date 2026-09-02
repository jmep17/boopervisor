import Link from "next/link";

import { cn } from "@/lib/cn";
import type { ProjectFile } from "@/lib/config/editing-scope";

/**
 * Which of the selected project's two files an edit on this page writes to. Project-local
 * settings win over project settings, so the choice changes both what gets written and how
 * the breakdown below reads "overridden".
 */
export function SettingsFileSwitch({
  file,
  query,
}: {
  file: ProjectFile;
  query: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <p className="max-w-prose text-sm text-gray-900">
        Edits on this page are written to the file chosen here. Project-local
        settings win over project settings.
      </p>
      <div className="flex gap-4">
        <Link
          href={settingsFileHref("project", query)}
          aria-current={file === "project" ? "true" : undefined}
          className={cn(
            "text-sm underline-offset-2 hover:underline",
            file === "project" ? "text-gray-1000" : "text-gray-900"
          )}
        >
          Project <span className="font-mono">.claude/settings.json</span>
        </Link>
        <Link
          href={settingsFileHref("local", query)}
          aria-current={file === "local" ? "true" : undefined}
          className={cn(
            "text-sm underline-offset-2 hover:underline",
            file === "local" ? "text-gray-1000" : "text-gray-900"
          )}
        >
          Project-local{" "}
          <span className="font-mono">.claude/settings.local.json</span>
        </Link>
      </div>
    </section>
  );
}

function settingsFileHref(file: ProjectFile, query: string): string {
  const params = new URLSearchParams();
  if (file === "local") params.set("file", "local");
  if (query.trim() !== "") params.set("q", query);
  const search = params.toString();
  return search === "" ? "/settings" : `/settings?${search}`;
}
