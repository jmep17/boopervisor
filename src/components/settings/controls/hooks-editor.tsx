"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrashIcon, PlusIcon } from "lucide-react";
import { HOOK_EVENTS } from "@/lib/catalog/hooks";
import { parseHooksObject } from "@/lib/config/hooks";

export interface HooksEditorControlProps {
  value: unknown;
}

interface HookEntryUI {
  event: string;
  matcher: string;
  command: string;
}

/** Hook entries editor organized by event from the catalog. */
/**
 * The script a command runs, where the command is one. A command that pipes or chains is
 * shown as it is rather than guessed at.
 */
function scriptPath(command: string): string | undefined {
  const [word] = command.trim().split(/\s+/);
  return word &&
    (word.startsWith("/") || word.startsWith("~") || word.startsWith("./"))
    ? word
    : undefined;
}

export function HooksEditorControl({ value }: HooksEditorControlProps) {
  // Parse the value into event → entries map
  const parsed = parseHooksObject(value);
  const initialHooks = parsed.ok ? parsed.hooks : {};

  // Initialize state from parsed hooks
  const [hooks, setHooks] = useState<Record<string, HookEntryUI[]>>(() => {
    const result: Record<string, HookEntryUI[]> = {};
    for (const [event, entries] of Object.entries(initialHooks)) {
      result[event] = entries.map((entry) => ({
        event,
        ...entry,
      }));
    }
    return result;
  });

  const [errors] = useState<Record<string, string>>({});

  const handleAddEntry = (event: string) => {
    setHooks((prev) => ({
      ...prev,
      [event]: [...(prev[event] || []), { event, matcher: "", command: "" }],
    }));
  };

  const handleRemoveEntry = (event: string, index: number) => {
    setHooks((prev) => ({
      ...prev,
      [event]: prev[event].filter((_, i) => i !== index),
    }));
  };

  const handleUpdateEntry = (
    event: string,
    index: number,
    field: "matcher" | "command",
    value: string
  ) => {
    setHooks((prev) => ({
      ...prev,
      [event]: prev[event].map((entry, i) =>
        i === index ? { ...entry, [field]: value } : entry
      ),
    }));
  };

  // Assemble the value for submission
  const submittedValue: Record<string, unknown> = {};
  for (const [event, entries] of Object.entries(hooks)) {
    if (entries.length > 0) {
      submittedValue[event] = entries.map((entry) => ({
        matcher: entry.matcher,
        command: entry.command,
      }));
    }
  }
  const serialized = JSON.stringify(submittedValue);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {HOOK_EVENTS.map((event) => (
          <div
            key={event.event}
            className="flex flex-col gap-2 rounded-base border border-gray-alpha-300 p-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm text-gray-1000">
                {event.event}
              </h4>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleAddEntry(event.event)}
              >
                <PlusIcon className="size-4" />
                Add hook
              </Button>
            </div>

            {hooks[event.event] && hooks[event.event].length > 0 ? (
              <div className="flex flex-col gap-2">
                {hooks[event.event].map((entry, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-1 rounded-sm border border-gray-alpha-200 p-2"
                  >
                    <div className="flex flex-col gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <label className="w-16 font-medium text-gray-900">
                          Matcher:
                        </label>
                        <Input
                          type="text"
                          value={entry.matcher}
                          onChange={(e) =>
                            handleUpdateEntry(
                              event.event,
                              index,
                              "matcher",
                              e.currentTarget.value
                            )
                          }
                          placeholder="Optional pattern match"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveEntry(event.event, index)}
                          title="Remove hook"
                        >
                          <TrashIcon className="size-4 text-red-900" />
                        </Button>
                      </div>
                      <div className="flex items-start gap-2">
                        <label className="w-16 font-medium text-gray-900 pt-1">
                          Command:
                        </label>
                        <div className="flex-1">
                          <Input
                            type="text"
                            value={entry.command}
                            onChange={(e) =>
                              handleUpdateEntry(
                                event.event,
                                index,
                                "command",
                                e.currentTarget.value
                              )
                            }
                            placeholder="The command Claude Code runs"
                            className="font-mono"
                          />
                          <p className="mt-1 text-xs text-gray-800">
                            {scriptPath(entry.command) ? (
                              <>
                                Runs{" "}
                                <span className="font-mono">
                                  {scriptPath(entry.command)}
                                </span>
                                . Boopervisor never writes that file — open it
                                to change what the hook does.
                              </>
                            ) : (
                              "Boopervisor writes this line into the settings file, and never the script it runs."
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                    {errors[`${event.event}-${index}`] && (
                      <p className="text-xs text-red-900">
                        {errors[`${event.event}-${index}`]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-800">
                No hooks configured for this event.
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Hidden field for form submission */}
      <input type="hidden" name="value" value={serialized} />

      {/* Validation marker */}
      <input type="hidden" name="validateOnSubmit" value="hooks" />
    </div>
  );
}
