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
import { parsePermissionsObject } from "@/lib/config/permissions";

export interface PermissionRulesControlProps {
  value: unknown;
}

interface RuleListProps {
  rules: string[];
  listType: "allow" | "ask" | "deny";
  title: string;
  errors: Record<string, string>;
  onAddRule: (list: "allow" | "ask" | "deny") => void;
  onUpdateRule: (
    list: "allow" | "ask" | "deny",
    index: number,
    newValue: string
  ) => void;
  onRemoveRule: (list: "allow" | "ask" | "deny", index: number) => void;
  onMoveUp: (list: "allow" | "ask" | "deny", index: number) => void;
  onMoveDown: (list: "allow" | "ask" | "deny", index: number) => void;
}

function RuleList({
  rules,
  listType,
  title,
  errors,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
  onMoveUp,
  onMoveDown,
}: RuleListProps) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="font-medium text-sm text-gray-1000">{title}</h4>
      <div className="flex flex-col gap-2">
        {rules.map((rule, index) => (
          <div key={index} className="flex flex-col gap-1">
            <div className="flex gap-2">
              <Input
                type="text"
                value={rule}
                onChange={(e) =>
                  onUpdateRule(listType, index, e.currentTarget.value)
                }
                placeholder="Tool or Tool(specifier)"
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onMoveUp(listType, index)}
                disabled={index === 0}
                title="Move up"
              >
                <ChevronUpIcon className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onMoveDown(listType, index)}
                disabled={index === rules.length - 1}
                title="Move down"
              >
                <ChevronDownIcon className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemoveRule(listType, index)}
                title="Remove rule"
              >
                <TrashIcon className="size-4 text-red-900" />
              </Button>
            </div>
            {errors[`${listType}-${index}`] && (
              <p className="text-sm text-red-900">
                {errors[`${listType}-${index}`]}
              </p>
            )}
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => onAddRule(listType)}
      >
        <PlusIcon className="size-4" />
        Add {listType}
      </Button>
    </div>
  );
}

/** A set of permission rules organized by allow, ask, deny. */
export function PermissionRulesControl({ value }: PermissionRulesControlProps) {
  // Parse the value into allow, ask, deny arrays
  const parsed = parsePermissionsObject(value);
  const initialAllow = parsed.ok ? parsed.allow : [];
  const initialAsk = parsed.ok ? parsed.ask : [];
  const initialDeny = parsed.ok ? parsed.deny : [];

  const [allow, setAllow] = useState<string[]>(initialAllow);
  const [ask, setAsk] = useState<string[]>(initialAsk);
  const [deny, setDeny] = useState<string[]>(initialDeny);

  const [errors] = useState<Record<string, string>>({});

  const handleAddRule = (list: "allow" | "ask" | "deny") => {
    if (list === "allow") {
      setAllow([...allow, ""]);
    } else if (list === "ask") {
      setAsk([...ask, ""]);
    } else {
      setDeny([...deny, ""]);
    }
  };

  const handleUpdateRule = (
    list: "allow" | "ask" | "deny",
    index: number,
    newValue: string
  ) => {
    if (list === "allow") {
      const updated = [...allow];
      updated[index] = newValue;
      setAllow(updated);
    } else if (list === "ask") {
      const updated = [...ask];
      updated[index] = newValue;
      setAsk(updated);
    } else {
      const updated = [...deny];
      updated[index] = newValue;
      setDeny(updated);
    }
  };

  const handleRemoveRule = (list: "allow" | "ask" | "deny", index: number) => {
    if (list === "allow") {
      setAllow(allow.filter((_, i) => i !== index));
    } else if (list === "ask") {
      setAsk(ask.filter((_, i) => i !== index));
    } else {
      setDeny(deny.filter((_, i) => i !== index));
    }
  };

  const handleMoveUp = (list: "allow" | "ask" | "deny", index: number) => {
    if (index === 0) return;
    const source = list === "allow" ? allow : list === "ask" ? ask : deny;
    const updated = [...source];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];

    if (list === "allow") setAllow(updated);
    else if (list === "ask") setAsk(updated);
    else setDeny(updated);
  };

  const handleMoveDown = (list: "allow" | "ask" | "deny", index: number) => {
    const source = list === "allow" ? allow : list === "ask" ? ask : deny;
    if (index === source.length - 1) return;
    const updated = [...source];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];

    if (list === "allow") setAllow(updated);
    else if (list === "ask") setAsk(updated);
    else setDeny(updated);
  };

  // Assemble the value for submission
  const submittedValue: Record<string, unknown> = {};
  if (allow.length > 0) submittedValue.allow = allow;
  if (ask.length > 0) submittedValue.ask = ask;
  if (deny.length > 0) submittedValue.deny = deny;
  const serialized = JSON.stringify(submittedValue);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <RuleList
          rules={deny}
          listType="deny"
          title="Deny (checked first)"
          errors={errors}
          onAddRule={handleAddRule}
          onUpdateRule={handleUpdateRule}
          onRemoveRule={handleRemoveRule}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
        />
        <RuleList
          rules={ask}
          listType="ask"
          title="Ask (checked second)"
          errors={errors}
          onAddRule={handleAddRule}
          onUpdateRule={handleUpdateRule}
          onRemoveRule={handleRemoveRule}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
        />
        <RuleList
          rules={allow}
          listType="allow"
          title="Allow (checked last)"
          errors={errors}
          onAddRule={handleAddRule}
          onUpdateRule={handleUpdateRule}
          onRemoveRule={handleRemoveRule}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
        />
      </div>

      {/* Hidden field for form submission */}
      <input type="hidden" name="value" value={serialized} />

      {/* Validation button - this will be used via JavaScript to validate before submit */}
      <input type="hidden" name="validateOnSubmit" value="permission-rules" />
    </div>
  );
}
