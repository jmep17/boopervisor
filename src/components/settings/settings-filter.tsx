"use client";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export interface SettingsFilterProps {
  query: string;
  onQueryChange: (query: string) => void;
  /** How many settings the query matches, and how many there are in all. */
  shown: number;
  total: number;
}

/** The search field above the settings list, and the count of what it matches. */
export function SettingsFilter({
  query,
  onQueryChange,
  shown,
  total,
}: SettingsFilterProps) {
  return (
    <div className="flex flex-col gap-2">
      <Field label="Find a setting">
        <Input
          type="search"
          name="q"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Key, description or topic"
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      <div className="flex items-center gap-4">
        <p role="status" className="text-sm text-gray-900">
          {query === ""
            ? `${total} settings`
            : `${shown} of ${total} settings match`}
        </p>
        {query === "" ? null : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onQueryChange("")}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
