"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
  type AriaAttributes,
  type ComponentProps,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";

interface FieldContextValue {
  /** The id the label points at. A control with its own id reports it here. */
  controlId: string;
  claimControlId: (id: string | undefined) => void;
  describedBy: string | undefined;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * Aria plumbing for one control inside a `Field`: the id its label points at,
 * the description and error that describe it, and its invalid state. A control
 * outside a `Field` gets its props back untouched, so every control in the set
 * works standalone as well as in a form.
 *
 * A `Field` labels exactly one control.
 */
export interface FieldControlProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
}

export function useFieldControl<P extends FieldControlProps>(props: P): P {
  const field = useContext(FieldContext);
  const { claimControlId } = field ?? {};
  const ownId = props.id;

  useEffect(() => {
    claimControlId?.(ownId);
  }, [claimControlId, ownId]);

  if (!field) return props;

  const describedBy =
    [props["aria-describedby"], field.describedBy].filter(Boolean).join(" ") || undefined;

  return {
    ...props,
    id: ownId ?? field.controlId,
    "aria-describedby": describedBy,
    "aria-invalid": props["aria-invalid"] ?? (field.invalid ? true : undefined),
  };
}

export interface FieldProps extends Omit<ComponentProps<"div">, "children"> {
  label: ReactNode;
  /** Static help text, shown whether or not the value is valid. */
  description?: ReactNode;
  /** A validation failure. Shown instead of nothing, and marks the control invalid. */
  error?: ReactNode;
  children: ReactNode;
}

export function Field({
  label,
  description,
  error,
  className,
  children,
  ...props
}: FieldProps) {
  const generatedId = useId();
  const [claimedId, setClaimedId] = useState<string>();
  const controlId = claimedId ?? generatedId;
  const descriptionId = `${generatedId}-description`;
  const errorId = `${generatedId}-error`;

  const describedBy =
    [description ? descriptionId : undefined, error ? errorId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <FieldContext
      value={{
        controlId,
        claimControlId: setClaimedId,
        describedBy,
        invalid: Boolean(error),
      }}
    >
      <div data-slot="field" className={cn("flex flex-col gap-2", className)} {...props}>
        <label
          htmlFor={controlId}
          className="text-sm font-medium text-gray-1000 w-fit"
        >
          {label}
        </label>
        {children}
        {description ? (
          <p id={descriptionId} className="text-sm text-gray-900">
            {description}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} role="alert" className="text-sm text-red-900">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext>
  );
}
