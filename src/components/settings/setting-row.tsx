"use client";

import { useActionState, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { writeSetting, type WriteSettingState } from "@/lib/config/actions";
import { isOverridden, type EffectiveValue } from "@/lib/config/effective";
import type { OptionSource, Scope, SettingDefinition } from "@/lib/catalog";
import { SCOPE_LABELS } from "./scope-labels";
import { ControlComponent } from "./control-component";
import { ConfirmWriteDialog } from "./confirm-write-dialog";
import { SettingDetails } from "./setting-details";

export interface SettingRowProps {
  /** Absent for a key found on disk that the catalog does not describe. */
  definition?: SettingDefinition;
  effective: EffectiveValue;
  /** The scope an edit writes to: the one the header selects. */
  editing: Scope;
  /** Identifies the file the form was composed against, so a stale write is refused. */
  expected: string;
  /** Machine-local option lists, resolved when the page rendered. */
  options?: Partial<Record<OptionSource, string[]>>;
  /** Managed settings, which Boopervisor only ever reads. */
  readOnly: boolean;
}

/** How a value reads in the list: JSON, because that is what is in the file. */
function show(value: unknown): string {
  return value === undefined ? "Not set" : JSON.stringify(value);
}

export function SettingRow({
  definition,
  effective,
  editing,
  expected,
  options,
  readOnly,
}: SettingRowProps) {
  const [state, submit, pending] = useActionState<WriteSettingState, FormData>(
    writeSetting,
    {}
  );
  const { key, effectiveValue, winningScope, perScope } = effective;
  const isSet = Object.keys(perScope).length > 0;
  const overridden = isOverridden(effective, editing);
  const formRef = useRef<HTMLFormElement>(null);
  const [confirming, setConfirming] = useState(false);
  const dangerous = definition?.dangerous ?? false;

  return (
    <details className="group rounded-base border border-gray-alpha-400 bg-background-100">
      <summary className="flex cursor-pointer flex-col gap-2 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-mono text-sm text-gray-1000">{key}</span>
          {definition ? (
            <span className="text-sm text-gray-900">{definition.summary}</span>
          ) : (
            <span className="text-sm text-gray-900">
              Not described by the catalog. Boopervisor leaves it as it found
              it.
            </span>
          )}
        </span>
        <span className="flex min-w-0 items-center gap-2 sm:max-w-[50%] sm:shrink">
          <span
            className="min-w-0 truncate font-mono text-sm text-gray-900"
            title={show(effectiveValue)}
          >
            {show(effectiveValue)}
          </span>
          {isSet ? (
            <Badge className="shrink-0">{SCOPE_LABELS[winningScope]}</Badge>
          ) : null}
          {definition ? null : (
            <Badge tone="warning" className="shrink-0">
              Uncatalogued
            </Badge>
          )}
          {dangerous ? (
            <Badge tone="warning" className="shrink-0">
              Confirms before writing
            </Badge>
          ) : null}
        </span>
      </summary>

      <div className="flex flex-col gap-4 border-t border-gray-alpha-400 px-4 py-4">
        {definition ? <SettingDetails definition={definition} /> : null}

        <dl className="flex flex-col gap-1 text-sm">
          {(Object.keys(SCOPE_LABELS) as Scope[])
            .filter((scope) => scope in perScope)
            .map((scope) => (
              <div
                key={scope}
                className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <dt
                  className={
                    scope === winningScope ? "text-gray-1000" : "text-gray-900"
                  }
                >
                  {SCOPE_LABELS[scope]}
                  {scope === winningScope ? " — wins" : null}
                </dt>
                <dd className="min-w-0 break-all font-mono text-gray-1000">
                  {show(perScope[scope])}
                </dd>
              </div>
            ))}
          {isSet ? null : <p className="text-gray-900">Set in no scope.</p>}
        </dl>

        {readOnly ? (
          <p className="text-sm text-gray-900">
            Managed settings belong to whoever administers this machine.
            Boopervisor only reads them.
          </p>
        ) : (
          <form ref={formRef} action={submit} className="flex flex-col gap-3">
            <input type="hidden" name="key" value={key} />
            <input type="hidden" name="scope" value={editing} />
            <input type="hidden" name="expected" value={expected} />

            <Field
              label={`Value in ${SCOPE_LABELS[editing].toLowerCase()} settings`}
              description={
                overridden
                  ? `${SCOPE_LABELS[winningScope]} settings set this too, and win. Editing here will not change the effective value.`
                  : undefined
              }
              error={state.error}
            >
              <ControlComponent
                definition={definition}
                value={perScope[editing]}
                options={options}
              />
            </Field>

            <div className="flex items-center gap-2">
              {dangerous ? (
                <Button
                  type="button"
                  onClick={() => setConfirming(true)}
                  disabled={pending}
                >
                  {pending ? "Saving" : "Save"}
                </Button>
              ) : (
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving" : "Save"}
                </Button>
              )}
              {editing in perScope ? (
                <Button
                  type="submit"
                  name="unset"
                  value="1"
                  variant="secondary"
                  disabled={pending}
                >
                  Unset
                </Button>
              ) : null}
            </div>
          </form>
        )}

        {definition?.dangerous ? (
          <ConfirmWriteDialog
            open={confirming}
            onOpenChange={setConfirming}
            settingKey={key}
            reason={definition.overrideNote}
            pending={pending}
            onConfirm={() => {
              setConfirming(false);
              formRef.current?.requestSubmit();
            }}
          />
        ) : null}
      </div>
    </details>
  );
}
