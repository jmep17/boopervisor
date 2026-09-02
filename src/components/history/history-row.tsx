"use client";

import { useActionState, useState } from "react";
import { basename } from "node:path";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { restoreFromBackup, type RestoreState } from "@/lib/history/actions";
import { diffText } from "@/lib/history/diff";
import type { MutationRecord, MutationTarget } from "@/lib/config/mutations";
import { SCOPE_LABELS } from "@/components/settings/scope-labels";

export interface HistoryRowProps {
  record: MutationRecord;
  canRestore: boolean;
  expectedFile: string;
}

/**
 * One mutation entry: timestamp, file, target description, diff, and restore button.
 */
export function HistoryRow({
  record,
  canRestore,
  expectedFile,
}: HistoryRowProps) {
  const [showRestore, setShowRestore] = useState(false);
  const [state, submit, pending] = useActionState<RestoreState, FormData>(
    restoreFromBackup,
    {}
  );

  const diff = diffText(record.before, record.after);
  const timestamp = new Date(record.timestamp);
  const timeStr = timestamp.toLocaleString();

  const targetLabel = getTargetLabel(record.target);
  const scopeLabel =
    "scope" in record.target
      ? (SCOPE_LABELS[record.target.scope] ?? record.target.scope)
      : undefined;

  return (
    <>
      <details className="group rounded-base border border-gray-alpha-400 bg-background-100">
        <summary className="flex cursor-pointer items-baseline justify-between gap-4 px-4 py-3">
          <span className="flex flex-col gap-1">
            <span className="text-sm text-gray-1000">{targetLabel}</span>
            <span className="text-sm text-gray-900">
              <span className="font-mono">{record.path}</span> {timeStr}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {scopeLabel ? <Badge>{scopeLabel}</Badge> : null}
          </span>
        </summary>

        <div className="flex flex-col gap-4 border-t border-gray-alpha-400 px-4 py-4">
          {/* Diff display */}
          {diff.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-gray-900">Changes:</p>
              <pre className="max-h-64 overflow-auto rounded-base bg-background-200 p-3 text-sm font-mono text-gray-1000">
                {diff.map((line, idx) => (
                  <div
                    key={idx}
                    className={
                      line.type === "remove"
                        ? "text-red-700"
                        : line.type === "add"
                          ? "text-green-700"
                          : "text-gray-900"
                    }
                  >
                    <span className="mr-2">
                      {line.type === "remove"
                        ? "−"
                        : line.type === "add"
                          ? "+"
                          : " "}
                    </span>
                    {line.text}
                  </div>
                ))}
              </pre>
            </div>
          ) : null}

          {/* Restore button */}
          {canRestore ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowRestore(true)}
            >
              Restore this backup
            </Button>
          ) : (
            <p className="text-sm text-gray-900">
              This backup file was pruned and cannot be restored.
            </p>
          )}
        </div>
      </details>

      {/* Restore confirmation dialog */}
      <Dialog open={showRestore} onOpenChange={setShowRestore}>
        <DialogContent>
          <div className="flex flex-col gap-1">
            <DialogTitle>Restore backup?</DialogTitle>
            <DialogDescription>
              This will overwrite {basename(record.path)} and create a new
              backup of the current state.
            </DialogDescription>
          </div>

          <form action={submit} className="flex flex-col gap-4">
            <input type="hidden" name="backupPath" value={record.backupPath} />
            <input type="hidden" name="targetPath" value={record.path} />
            <input type="hidden" name="expected" value={expectedFile} />

            {state.error ? (
              <div className="rounded-base bg-red-100 p-3 text-sm text-red-900">
                {state.error}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowRestore(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Restoring…" : "Restore"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Formats the mutation target into a human-readable string.
 */
function getTargetLabel(target: MutationTarget): string {
  switch (target.kind) {
    case "setting":
      return `Setting: ${target.key}`;
    case "item":
      return `${target.item}: ${target.name}`;
    case "restore":
      return "Restore";
    default:
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = target;
      return "Unknown change";
  }
}
