import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { PluginList } from "./plugin-list";

/** Selection and the archived filter travel in the URL, so both survive a reload. */
export default async function PluginsPage({
  searchParams,
}: PageProps<"/plugins">) {
  const { item, archived } = await searchParams;

  return (
    <>
      <PageHeader
        title="Plugins"
        description="Installed plugins, the marketplace each came from, and their state."
      />
      <Suspense
        fallback={<p className="text-sm text-gray-900">Reading plugins…</p>}
      >
        <PluginList
          selectedId={typeof item === "string" ? item : undefined}
          showArchived={archived === "1"}
        />
      </Suspense>
    </>
  );
}
