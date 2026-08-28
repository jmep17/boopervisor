"use client";

import { useState } from "react";

import { Textarea } from "@/components/ui/textarea";

export interface JsonControlProps {
  value: unknown;
}

/**
 * Structured values are edited as JSON until they earn an editor of their own. The form
 * will not submit text that is not JSON: the browser refuses it before the server has to.
 */
export function JsonControl({ value }: JsonControlProps) {
  const [problem, setProblem] = useState<string>();

  return (
    <>
      <Textarea
        name="value"
        defaultValue={value === undefined ? "" : JSON.stringify(value, null, 2)}
        placeholder='{"key": "value"}'
        aria-invalid={problem ? true : undefined}
        className="font-mono text-sm"
        onChange={(event) => {
          const message = jsonProblem(event.currentTarget.value);
          // A control the browser marks invalid stops the form submitting.
          event.currentTarget.setCustomValidity(message ?? "");
          setProblem(message);
        }}
      />
      {problem ? (
        <p role="alert" className="text-xs text-red-900">
          {problem}
        </p>
      ) : null}
    </>
  );
}

/** What is wrong with the text, or nothing when it is JSON. Empty unsets the key. */
function jsonProblem(text: string): string | undefined {
  if (text.trim() === "") return undefined;
  try {
    JSON.parse(text);
    return undefined;
  } catch (error) {
    return `Not valid JSON: ${(error as Error).message}`;
  }
}
