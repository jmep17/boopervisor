"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ConfirmWriteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settingKey: string;
  /** The catalog's note on why this key warrants a confirmation. */
  reason?: string;
  onConfirm: () => void;
  pending?: boolean;
}

/** Asks before a dangerous key is written, naming the key and the catalog's reason. */
export function ConfirmWriteDialog({
  open,
  onOpenChange,
  settingKey,
  reason,
  onConfirm,
  pending,
}: ConfirmWriteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="flex flex-col gap-1">
          <DialogTitle>Write {settingKey}?</DialogTitle>
          <DialogDescription>
            {reason ??
              "This setting changes what Claude Code will do without asking."}
          </DialogDescription>
        </div>

        <p className="text-sm text-gray-900">
          It is backed up first and can be restored from History.
        </p>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Writing…" : "Write it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
