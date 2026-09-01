import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { ItemState } from "@/lib/items/item-state";

export interface MasterDetailItem {
  /** Stable within one listing; it is what the URL carries. */
  id: string;
  label: string;
  /** Shown under the label, where two items may share a name. */
  detail?: string;
  state: ItemState;
}

const STATE_TONE = {
  enabled: undefined,
  disabled: "warning",
  archived: "neutral",
} as const;

/**
 * The shape every item listing takes: the items on the left, the selected one's detail and
 * state controls on the right. Selection and the archived filter live in the URL, so both
 * survive a reload and neither needs client state.
 */
export function MasterDetail({
  items,
  selectedId,
  showArchived,
  empty,
  children,
}: {
  items: readonly MasterDetailItem[];
  selectedId?: string;
  /** Archived items are held out of the listing unless asked for. */
  showArchived: boolean;
  /** What to say when there is nothing to list. */
  empty: string;
  /** The selected item's detail. */
  children: ReactNode;
}) {
  const visible = showArchived
    ? items
    : items.filter((item) => item.state !== "archived");
  const archivedCount = items.filter(
    (item) => item.state === "archived"
  ).length;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[16rem_1fr]">
      <div className={cn("flex flex-col gap-2", selectedId && "max-md:hidden")}>
        <ul className="flex flex-col gap-1">
          {visible.map((item) => (
            <li key={item.id}>
              <Link
                href={itemHref(item.id, showArchived)}
                aria-current={item.id === selectedId ? "true" : undefined}
                className={cn(
                  "flex flex-col gap-0.5 rounded-base px-3 py-2 text-sm",
                  "hover:bg-gray-alpha-100",
                  item.id === selectedId
                    ? "bg-gray-alpha-200 text-gray-1000"
                    : "text-gray-900"
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate">{item.label}</span>
                  {STATE_TONE[item.state] ? (
                    <Badge tone={STATE_TONE[item.state]}>{item.state}</Badge>
                  ) : null}
                </span>
                {item.detail ? (
                  <span className="truncate text-xs text-gray-900">
                    {item.detail}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
          {visible.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-900">{empty}</li>
          ) : null}
        </ul>

        {archivedCount > 0 || showArchived ? (
          <Link
            href={itemHref(selectedId, !showArchived)}
            className="px-3 text-sm text-gray-900 underline-offset-2 hover:underline"
          >
            {showArchived
              ? "Hide archived"
              : `Show archived (${archivedCount})`}
          </Link>
        ) : null}
      </div>

      <div
        className={cn(
          "flex min-w-0 flex-col gap-4",
          !selectedId && "max-md:hidden"
        )}
      >
        {selectedId ? (
          <Link
            href={itemHref(undefined, showArchived)}
            className="w-fit text-sm text-gray-900 underline-offset-2 hover:underline md:hidden"
          >
            All items
          </Link>
        ) : null}
        {children}
      </div>
    </div>
  );
}

/** Selection and the archived filter are both query parameters of the page itself. */
function itemHref(id: string | undefined, showArchived: boolean): string {
  const params = new URLSearchParams();
  if (id) params.set("item", id);
  if (showArchived) params.set("archived", "1");
  const query = params.toString();
  return query ? `?${query}` : "?";
}
