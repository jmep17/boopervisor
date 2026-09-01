import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { SettingsList } from "@/components/settings/settings-list";
import { parseProjectFile } from "@/lib/config/editing-scope";

/** Which of a project's two files an edit lands in travels in the URL, like every other
 * listing filter in this app. */
export default async function SettingsPage({
  searchParams,
}: PageProps<"/settings">) {
  const { file } = await searchParams;

  return (
    <>
      <PageHeader
        title="Settings"
        description="Every documented Claude Code setting, its effective value, and the scope that won."
      />
      <Suspense
        fallback={<p className="text-sm text-gray-900">Reading settings…</p>}
      >
        <SettingsList file={parseProjectFile(file)} />
      </Suspense>
    </>
  );
}
