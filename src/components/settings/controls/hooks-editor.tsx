"use client";

import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrashIcon } from "lucide-react";
import { HOOK_EVENTS, isUnknownHookEvent } from "@/lib/catalog/hooks";
import {
  assembleHooksObject,
  parseHooksObject,
  type HookAction,
  type HookGroup,
  type HooksByEvent,
} from "@/lib/config/hooks";
import { JsonControl } from "./json";

export interface HooksEditorControlProps {
  value: unknown;
}

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
  const parsed = parseHooksObject(value);

  // A value we cannot parse is never replaced with an empty one — that is the wipe this
  // editor exists to prevent. Fall back to the JSON control, which round-trips the value
  // as it is on disk.
  if (!parsed.ok) {
    return (
      <div className="flex flex-col gap-2">
        <p role="alert" className="text-sm text-red-900">
          The hooks in this file aren&apos;t in the shape Boopervisor can edit
          as a form ({parsed.problem}). Showing the value as JSON instead.
        </p>
        <JsonControl value={value} />
      </div>
    );
  }

  return <HooksForm initialHooks={parsed.hooks} />;
}

function HooksForm({ initialHooks }: { initialHooks: HooksByEvent }) {
  const [hooks, setHooks] = useState<HooksByEvent>(initialHooks);

  const knownEvents = HOOK_EVENTS.map((e) => e.event);
  const unknownEvents = Object.keys(hooks).filter((event) =>
    isUnknownHookEvent(event)
  );
  const events = [...knownEvents, ...unknownEvents];

  const groupsFor = (event: string): HookGroup[] => hooks[event] ?? [];

  const setGroups = (event: string, groups: HookGroup[]) => {
    setHooks((prev) => ({ ...prev, [event]: groups }));
  };

  const addGroup = (event: string) => {
    setGroups(event, [...groupsFor(event), { matcher: "", hooks: [] }]);
  };

  const removeGroup = (event: string, groupIndex: number) => {
    setGroups(
      event,
      groupsFor(event).filter((_, i) => i !== groupIndex)
    );
  };

  const updateGroup = (event: string, groupIndex: number, group: HookGroup) => {
    setGroups(
      event,
      groupsFor(event).map((g, i) => (i === groupIndex ? group : g))
    );
  };

  const serialized = JSON.stringify(assembleHooksObject(hooks));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-6">
        {events.map((event) => (
          <div key={event} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-heading-14 font-semibold text-gray-1000">
                  {event}
                </h4>
                {isUnknownHookEvent(event) ? (
                  <Badge tone="warning">Not in the catalog</Badge>
                ) : null}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => addGroup(event)}
              >
                Add group
              </Button>
            </div>

            {groupsFor(event).length > 0 ? (
              <div className="flex flex-col gap-2">
                {groupsFor(event).map((group, groupIndex) => (
                  <GroupEditor
                    key={groupIndex}
                    group={group}
                    groupIndex={groupIndex}
                    onChange={(next) => updateGroup(event, groupIndex, next)}
                    onRemove={() => removeGroup(event, groupIndex)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-900">
                No hooks configured for this event.
              </p>
            )}
          </div>
        ))}
      </div>

      <input type="hidden" name="value" value={serialized} />
    </div>
  );
}

function GroupEditor({
  group,
  groupIndex,
  onChange,
  onRemove,
}: {
  group: HookGroup;
  groupIndex: number;
  onChange: (group: HookGroup) => void;
  onRemove: () => void;
}) {
  const groupId = useId();
  const addCommandHook = () => {
    onChange({
      ...group,
      hooks: [...group.hooks, { type: "command", command: "" }],
    });
  };

  const removeHook = (index: number) => {
    onChange({ ...group, hooks: group.hooks.filter((_, i) => i !== index) });
  };

  const updateHook = (index: number, hook: HookAction) => {
    onChange({
      ...group,
      hooks: group.hooks.map((h, i) => (i === index ? hook : h)),
    });
  };

  return (
    <div className="flex flex-col gap-2 border-l-2 border-gray-alpha-400 pl-3">
      <div className="flex items-center gap-2 text-sm">
        <label
          htmlFor={`${groupId}-matcher`}
          className="w-24 font-medium text-gray-900"
        >
          Matcher:
        </label>
        <Input
          id={`${groupId}-matcher`}
          type="text"
          value={group.matcher ?? ""}
          onChange={(e) =>
            onChange({ ...group, matcher: e.currentTarget.value })
          }
          placeholder="Tool name or pattern, e.g. Bash or Edit|Write. Blank means every occurrence."
          className="flex-1"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          title="Remove group"
          aria-label={`Remove group ${groupIndex + 1}`}
        >
          <TrashIcon className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {group.hooks.map((hook, index) =>
          hook.type === "command" ? (
            <CommandHookEditor
              key={index}
              hook={hook}
              onChange={(next) => updateHook(index, next)}
              onRemove={() => removeHook(index)}
              hookIndex={index}
            />
          ) : (
            <OtherHookEditor
              key={index}
              hook={hook}
              onRemove={() => removeHook(index)}
              hookIndex={index}
            />
          )
        )}
      </div>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={addCommandHook}
      >
        Add command hook
      </Button>
    </div>
  );
}

function CommandHookEditor({
  hook,
  hookIndex,
  onChange,
  onRemove,
}: {
  hook: HookAction;
  hookIndex: number;
  onChange: (hook: HookAction) => void;
  onRemove: () => void;
}) {
  const command = hook.command ?? "";
  const inputId = useId();

  return (
    <div className="flex items-start gap-2">
      <label className="w-24 pt-1 font-medium text-gray-900 text-sm">
        Command:
      </label>
      <div className="flex flex-1 flex-col gap-1">
        <Input
          id={`${inputId}-command`}
          type="text"
          value={command}
          onChange={(e) =>
            onChange({ ...hook, command: e.currentTarget.value })
          }
          placeholder="The command Claude Code runs"
          className="font-mono"
        />
        <div className="flex items-center gap-2">
          <label
            htmlFor={`${inputId}-timeout`}
            className="text-sm text-gray-900"
          >
            Timeout (seconds):
          </label>
          <Input
            id={`${inputId}-timeout`}
            type="number"
            value={hook.timeout ?? ""}
            onChange={(e) => {
              const text = e.currentTarget.value;
              if (text === "") {
                const rest = { ...hook };
                delete rest.timeout;
                onChange(rest);
              } else {
                onChange({ ...hook, timeout: Number(text) });
              }
            }}
            className="w-24"
          />
        </div>
        <p className="text-sm text-gray-900">
          {scriptPath(command) ? (
            <>
              Runs <span className="font-mono">{scriptPath(command)}</span>.
              Boopervisor never writes that file. Open it to change what the
              hook does.
            </>
          ) : (
            "Boopervisor writes this line into the settings file, and never the script it runs."
          )}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        title="Remove hook"
        aria-label={`Remove hook ${hookIndex + 1}`}
      >
        <TrashIcon className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

function OtherHookEditor({
  hook,
  hookIndex,
  onRemove,
}: {
  hook: HookAction;
  hookIndex: number;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1">
        <pre className="overflow-x-auto rounded-base border border-gray-alpha-400 bg-background-200 p-3 font-mono text-sm text-gray-1000">
          {JSON.stringify(hook, null, 2)}
        </pre>
        <p className="mt-1 text-sm text-gray-900">
          A {hook.type} hook. Boopervisor edits command hooks as a form; edit
          this one as JSON.
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        title="Remove hook"
        aria-label={`Remove hook ${hookIndex + 1}`}
      >
        <TrashIcon className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
