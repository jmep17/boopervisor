"use client";

import { useActionState, useState, useTransition } from "react";

import {
  encodeScope,
  scopeLabel,
  scopeOptions,
  type ProjectOption,
  type ScopeSelection,
} from "@/lib/scope/scope";
import {
  addProjectScope,
  selectScope,
  type AddProjectState,
} from "@/lib/scope/actions";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "./ui/dialog";
import { Field } from "./ui/field";
import { Input } from "./ui/input";
import { Select, SelectItem } from "./ui/select";

/** Chosen from the same list as a scope, but opens the picker instead of selecting. */
const ADD_PROJECT_VALUE = "__add-project__";

export interface ScopeSwitcherViewProps {
  selected: ScopeSelection;
  projects: readonly ProjectOption[];
  onSelect: (encoded: string) => void;
  onAddProject: () => void;
  pending?: boolean;
}

/**
 * The switcher itself, given its behaviour rather than reaching for it, so it renders
 * alone in a test.
 */
export function ScopeSwitcherView({
  selected,
  projects,
  onSelect,
  onAddProject,
  pending,
}: ScopeSwitcherViewProps) {
  return (
    <Select
      aria-label="Scope"
      value={encodeScope(selected)}
      valueLabel={scopeLabel(selected)}
      disabled={pending}
      onValueChange={(value) =>
        value === ADD_PROJECT_VALUE ? onAddProject() : onSelect(value)
      }
      className="w-full sm:w-56"
    >
      {scopeOptions(projects).map((option) => (
        <SelectItem key={option.value} value={option.value}>
          <span className="flex flex-col">
            <span>{option.label}</span>
            {option.detail ? (
              <span className="font-mono text-sm text-gray-900">
                {option.detail}
              </span>
            ) : null}
          </span>
        </SelectItem>
      ))}
      <SelectItem value={ADD_PROJECT_VALUE}>
        Add a project directory…
      </SelectItem>
    </Select>
  );
}

export interface AddProjectFormProps {
  action: (
    state: AddProjectState,
    formData: FormData
  ) => Promise<AddProjectState>;
  onAdded: () => void;
}

/**
 * The manual directory picker: a path typed by hand, checked on the server. The browser
 * cannot hand a server a directory path, and nothing here searches the filesystem.
 */
export function AddProjectForm({ action, onAdded }: AddProjectFormProps) {
  // Controlled, because React resets the form on submit and a rejected path is the one
  // the user most wants to correct rather than retype.
  const [path, setPath] = useState("");
  const [state, formAction, pending] = useActionState(
    async (previous: AddProjectState, formData: FormData) => {
      const next = await action(previous, formData);
      if (!next.error) onAdded();
      return next;
    },
    {} satisfies AddProjectState
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="Directory"
        description="The absolute path to a project Claude Code has not recorded yet."
        error={state.error}
      >
        <Input
          name="path"
          value={path}
          onChange={(event) => setPath(event.target.value)}
          placeholder="/Users/you/src/project"
          autoComplete="off"
        />
      </Field>
      <DialogFooter>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Checking…" : "Add project"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ScopeSwitcher({
  selected,
  projects,
}: {
  selected: ScopeSelection;
  projects: readonly ProjectOption[];
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <ScopeSwitcherView
        selected={selected}
        projects={projects}
        pending={pending}
        onSelect={(encoded) => startTransition(() => selectScope(encoded))}
        onAddProject={() => setAdding(true)}
      />
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogTitle>Add a project</DialogTitle>
          <DialogDescription>
            Projects are listed from <code>~/.claude.json</code>. Add one it
            does not list by giving its directory.
          </DialogDescription>
          <AddProjectForm
            action={addProjectScope}
            onAdded={() => setAdding(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
