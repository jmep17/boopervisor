import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { SettingsList } from "@/components/settings/settings-list";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Every documented Claude Code setting, its effective value, and the scope that won."
      />
      <Suspense
        fallback={<p className="text-sm text-gray-900">Reading settings…</p>}
      >
        <SettingsList />
      </Suspense>
    </>
  );
}
