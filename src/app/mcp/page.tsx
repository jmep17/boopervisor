import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { McpServerList } from "./mcp-server-list";

/** Selection and the archived filter travel in the URL, so both survive a reload. */
export default async function McpPage({ searchParams }: PageProps<"/mcp">) {
  const { item, archived } = await searchParams;

  return (
    <>
      <PageHeader
        title="MCP servers"
        description="The MCP servers Claude Code will load in the selected scope, and their state."
      />
      <Suspense
        fallback={<p className="text-sm text-gray-900">Reading MCP servers…</p>}
      >
        <McpServerList
          selectedId={typeof item === "string" ? item : undefined}
          showArchived={archived === "1"}
        />
      </Suspense>
    </>
  );
}
