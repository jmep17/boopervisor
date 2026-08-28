"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  TrashIcon,
  PlusIcon,
} from "lucide-react";

export interface StringListControlProps {
  value: unknown;
}

/**
 * A list of strings, edited as a list: one input per entry, with add, remove and reorder.
 * The whole array goes to the server as JSON in one hidden field, so an entry holding a
 * newline or a comma is still one entry.
 */
export function StringListControl({ value }: StringListControlProps) {
  const initialEntries = Array.isArray(value) ? value.map(String) : [];
  const [entries, setEntries] = useState<string[]>(initialEntries);

  const handleAddEntry = () => {
    setEntries([...entries, ""]);
  };

  const handleUpdateEntry = (index: number, newValue: string) => {
    const updated = [...entries];
    updated[index] = newValue;
    setEntries(updated);
  };

  const handleRemoveEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...entries];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setEntries(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === entries.length - 1) return;
    const updated = [...entries];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setEntries(updated);
  };

  const serialized = JSON.stringify(entries);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {entries.map((entry, index) => (
          <div key={index} className="flex gap-2">
            <Input
              type="text"
              value={entry}
              onChange={(e) => handleUpdateEntry(index, e.currentTarget.value)}
              placeholder={`Entry ${index + 1}`}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleMoveUp(index)}
              disabled={index === 0}
              title="Move up"
            >
              <ChevronUpIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleMoveDown(index)}
              disabled={index === entries.length - 1}
              title="Move down"
            >
              <ChevronDownIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveEntry(index)}
              title="Remove entry"
            >
              <TrashIcon className="size-4 text-red-900" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleAddEntry}
      >
        <PlusIcon className="size-4" />
        Add entry
      </Button>
      <input type="hidden" name="value" value={serialized} />
    </div>
  );
}
