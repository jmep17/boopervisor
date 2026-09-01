"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { ItemState } from "@/lib/items/item-state";

export interface ItemStateAction {
  (previous: ItemStateResult, formData: FormData): Promise<ItemStateResult>;
}

export interface ItemStateResult {
  error?: string;
}

/**
 * The three states an item can be in, as three buttons. Uniform across skills, plugins and
 * MCP servers: disabling uses Claude Code's own mechanism for the item type, archival is
 * Boopervisor's own and moves no files.
 */
export function ItemStateControls({
  state,
  action,
  /** Named so the form can identify the item; the server decides everything else. */
  fields,
  /** Why the controls cannot change anything, when a higher-precedence scope decides it. */
  lockedReason,
}: {
  state: ItemState;
  action: ItemStateAction;
  fields: Record<string, string>;
  lockedReason?: string;
}) {
  const [result, submit, pending] = useActionState<ItemStateResult, FormData>(
    action,
    {}
  );

  return (
    <form action={submit} className="flex flex-col gap-2">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div className="flex items-center gap-2">
        {(["enabled", "disabled", "archived"] as const).map((target) => (
          <Button
            key={target}
            type="submit"
            name="state"
            value={target}
            variant={target === state ? "primary" : "secondary"}
            disabled={pending || target === state || Boolean(lockedReason)}
          >
            {
              { enabled: "Enable", disabled: "Disable", archived: "Archive" }[
                target
              ]
            }
          </Button>
        ))}
      </div>

      {lockedReason ? (
        <p className="text-sm text-gray-900">{lockedReason}</p>
      ) : null}
      {result.error ? (
        <p role="alert" className="text-sm text-red-900">
          {result.error}
        </p>
      ) : null}
    </form>
  );
}
