import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { SkillList } from "./skill-list";

/** Selection and the archived filter travel in the URL, so both survive a reload. */
export default async function SkillsPage({
  searchParams,
}: PageProps<"/skills">) {
  const { item, archived } = await searchParams;

  return (
    <>
      <PageHeader
        title="Skills"
        description="The skills available in the selected scope, and their state."
      />
      <Suspense
        fallback={<p className="text-sm text-gray-900">Reading skills…</p>}
      >
        <SkillList
          selectedId={typeof item === "string" ? item : undefined}
          showArchived={archived === "1"}
        />
      </Suspense>
    </>
  );
}
