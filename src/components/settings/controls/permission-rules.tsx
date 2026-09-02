"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronUpIcon, ChevronDownIcon, TrashIcon } from "lucide-react";
import { validatePermissionRule } from "@/lib/config/permissions";

export type PermissionList = "allow" | "ask" | "deny";

export interface PermissionRulesControlProps {
  /** The array at `permissions.<list>` on disk, or undefined when unset. */
  value: unknown;
  list: PermissionList;
}

/** Where each list sits in Claude Code's evaluation order. The order matters, so the interface says so. */
const ORDER_NOTE: Record<PermissionList, string> = {
  deny: "Deny rules are checked first. The first matching rule decides.",
  ask: "Ask rules are checked after deny rules and before allow rules.",
  allow:
    "Allow rules are checked last. A deny or ask rule that matches wins over these.",
};

/** Edits the one list of permission rules its key names, and submits it as a JSON array. */
export function PermissionRulesControl({
  value,
  list,
}: PermissionRulesControlProps) {
  const [rules, setRules] = useState<string[]>(
    Array.isArray(value) ? value.map(String) : []
  );
  const baseId = useId();

  const update = (index: number, rule: string) => {
    const updated = [...rules];
    updated[index] = rule;
    setRules(updated);
  };

  const remove = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...rules];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setRules(updated);
  };

  const moveDown = (index: number) => {
    if (index === rules.length - 1) return;
    const updated = [...rules];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setRules(updated);
  };

  // Blank entries are dropped so an added-then-abandoned row does not fail the save.
  const serialized = JSON.stringify(rules.filter((r) => r.trim() !== ""));

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-gray-900">{ORDER_NOTE[list]}</p>
      <div className="flex flex-col gap-2">
        {rules.map((rule, index) => {
          const inputId = `${baseId}-${index}`;
          const problemId = `${inputId}-problem`;
          const validation =
            rule.trim() === ""
              ? { ok: true as const }
              : validatePermissionRule(rule);
          const problem = validation.ok ? undefined : validation.problem;
          return (
            <div key={index} className="flex flex-col gap-1">
              <div className="flex gap-2">
                <Input
                  type="text"
                  id={inputId}
                  aria-label={`Rule ${index + 1}`}
                  aria-invalid={problem ? true : undefined}
                  aria-describedby={problem ? problemId : undefined}
                  value={rule}
                  onChange={(e) => update(index, e.currentTarget.value)}
                  placeholder="Tool or Tool(specifier)"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  title="Move up"
                  aria-label={`Move rule ${index + 1} up`}
                >
                  <ChevronUpIcon className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => moveDown(index)}
                  disabled={index === rules.length - 1}
                  title="Move down"
                  aria-label={`Move rule ${index + 1} down`}
                >
                  <ChevronDownIcon className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  title="Remove rule"
                  aria-label={`Remove rule ${index + 1}`}
                >
                  <TrashIcon className="size-4" aria-hidden="true" />
                </Button>
              </div>
              {problem ? (
                <p id={problemId} className="text-sm text-red-900">
                  {problem}
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
        onClick={() => setRules([...rules, ""])}
      >
        Add rule
      </Button>

      <input type="hidden" name="value" value={serialized} />
    </div>
  );
}
