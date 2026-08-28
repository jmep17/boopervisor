import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { HistoryList } from "@/components/history/history-list";

export default function HistoryPage() {
  return (
    <>
      <PageHeader
        title="History"
        description="Every change Boopervisor has written, with a diff and a way back."
      />
      <Suspense
        fallback={
          <p className="text-sm text-gray-900">Reading the mutation log…</p>
        }
      >
        <HistoryList />
      </Suspense>
    </>
  );
}
