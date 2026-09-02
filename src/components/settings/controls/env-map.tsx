"use client";

import { useId, useMemo, useState } from "react";
import { TrashIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Picker, type PickerOption } from "@/components/ui/picker";
import { withCodeSpans } from "../code-spans";

export interface EnvMapControlProps {
  value: unknown;
  /** The documented variables, name and purpose; empty when the server had none to give. */
  variables: PickerOption[];
}

type Entry = { name: string; value: string };

function initialEntries(value: unknown): Entry[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value).map(([name, entryValue]) => ({
    name,
    value: String(entryValue),
  }));
}

export function EnvMapControl({ value, variables }: EnvMapControlProps) {
  const baseId = useId();
  const [entries, setEntries] = useState<Entry[]>(() => initialEntries(value));
  const purposes = useMemo(
    () =>
      new Map(
        variables.map((variable) => [
          variable.value,
          variable.description ?? "",
        ])
      ),
    [variables]
  );

  const updateEntry = (index: number, update: Partial<Entry>) => {
    setEntries((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...update } : entry
      )
    );
  };

  const serialized = JSON.stringify(
    Object.fromEntries(
      entries
        .filter((entry) => entry.name.trim() !== "")
        .map((entry) => [entry.name.trim(), entry.value])
    )
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-900">
        A value here overrides the same variable exported in your shell. To
        cancel a shell export, set the variable to an empty string.
      </p>
      <div className="flex flex-col gap-2">
        {entries.map((entry, index) => {
          const trimmedName = entry.name.trim();
          const duplicate =
            trimmedName !== "" &&
            entries
              .slice(0, index)
              .some((earlier) => earlier.name.trim() === trimmedName);
          const description = purposes.get(trimmedName);
          const nameId = `${baseId}-${index}-name`;
          const valueId = `${baseId}-${index}-value`;
          return (
            <div key={index} className="flex flex-col gap-1">
              <div className="flex gap-2">
                <Picker
                  mode="free"
                  options={variables}
                  value={entry.name}
                  onValueChange={(name) => updateEntry(index, { name })}
                  id={nameId}
                  aria-label={`Variable ${index + 1} name`}
                  aria-invalid={duplicate || undefined}
                  placeholder="NAME"
                  className="flex-1"
                />
                <Input
                  type="text"
                  value={entry.value}
                  onChange={(event) =>
                    updateEntry(index, { value: event.currentTarget.value })
                  }
                  id={valueId}
                  aria-label={`Variable ${index + 1} value`}
                  autoComplete="off"
                  spellCheck={false}
                  className="flex-1 font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setEntries((current) =>
                      current.filter((_, entryIndex) => entryIndex !== index)
                    )
                  }
                  aria-label={`Remove variable ${index + 1}`}
                >
                  <TrashIcon className="size-4" />
                </Button>
              </div>
              {description ? (
                <p className="text-sm text-gray-900">
                  {withCodeSpans(description)}{" "}
                  <a
                    href="https://code.claude.com/docs/en/env-vars#variables"
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono underline"
                  >
                    env-vars#variables
                  </a>
                </p>
              ) : null}
              {description === undefined && trimmedName !== "" ? (
                <p className="text-sm text-gray-900">
                  Not in Claude Code&apos;s environment variables reference. It
                  is still set for the session and its subprocesses.
                </p>
              ) : null}
              {duplicate ? (
                <p className="text-sm text-gray-900">
                  Set twice above; the last value wins.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() =>
          setEntries((current) => [...current, { name: "", value: "" }])
        }
      >
        Add variable
      </Button>
      <input type="hidden" name="value" value={serialized} />
    </div>
  );
}
