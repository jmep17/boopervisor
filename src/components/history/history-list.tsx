import {
  encodeExpectedFile,
  captureFileSnapshot,
  exists,
} from "@/lib/config/mutate";
import { readMutationLog } from "@/lib/config/mutations";
import { HistoryRow } from "./history-row";

/**
 * Every mutation from the log, newest first, with the ability to restore any backup
 * that still exists on disk.
 */
export async function HistoryList() {
  const log = await readMutationLog();

  if (log.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-base border border-gray-alpha-400 bg-background-100 px-6 py-12">
        <p className="text-sm text-gray-900">No changes yet.</p>
      </div>
    );
  }

  // Verify which backups still exist and capture current file snapshots
  const backupExists: Record<string, boolean> = {};
  const fileSnapshots: Record<string, string> = {};

  for (const record of log) {
    if (!(record.backupPath in backupExists)) {
      backupExists[record.backupPath] = await exists(record.backupPath);
    }

    if (!(record.path in fileSnapshots)) {
      const snapshot = await captureFileSnapshot(record.path);
      fileSnapshots[record.path] = encodeExpectedFile(snapshot);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {log.map((record, index) => (
        <HistoryRow
          key={index}
          record={record}
          canRestore={backupExists[record.backupPath] ?? false}
          expectedFile={fileSnapshots[record.path]}
        />
      ))}
    </div>
  );
}
