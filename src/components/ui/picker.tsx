"use client";

import { ChevronDownIcon } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

import { cn } from "@/lib/cn";
import { queryTerms } from "@/lib/config/setting-search";
import { controlClassName } from "./control";
import { useFieldControl, type FieldControlProps } from "./field";

export interface PickerOption {
  value: string;
  /** One line under the value in the list; the reference's words where there are any. */
  description?: string;
}

export interface PickerProps extends FieldControlProps {
  /** The committed value. Controlled: the owner holds it. */
  value: string;
  onValueChange: (value: string) => void;
  options: PickerOption[];
  /** `strict`: the value must be one of the options. `free`: any text is a value. */
  mode: "strict" | "free";
  /** When given, a hidden input of this name carries the committed value to the form. */
  name?: string;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
}

export function Picker({
  value,
  onValueChange,
  options,
  mode,
  name,
  placeholder,
  className,
  ...props
}: PickerProps) {
  const listId = useId();
  const fieldProps = useFieldControl(props);
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [typed, setTyped] = useState(false);
  const syncedValue = useRef(value);

  const shownOptions = useMemo(() => {
    if (!typed) return options;
    const terms = queryTerms(text);
    return options.filter((option) => {
      const haystack =
        `${option.value}\n${option.description ?? ""}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [options, text, typed]);

  useEffect(() => {
    if (!open && syncedValue.current !== value) {
      setText(value);
      syncedValue.current = value;
    }
  }, [open, value]);

  function choose(option: PickerOption) {
    setText(option.value);
    onValueChange(option.value);
    setOpen(false);
    setTyped(false);
  }

  function showAllOptions() {
    setTyped(false);
    setActive(0);
    setOpen(true);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.currentTarget.value;
    setText(next);
    setTyped(true);
    setActive(0);
    setOpen(true);
    if (mode === "free") onValueChange(next);
  }

  function handleBlur() {
    setOpen(false);
    setTyped(false);
    if (mode === "free") return;

    if (text === "") {
      onValueChange("");
      return;
    }

    const exact = options.find(
      (option) => option.value.toLowerCase() === text.toLowerCase()
    );
    if (exact) {
      setText(exact.value);
      onValueChange(exact.value);
      return;
    }

    setText(value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        showAllOptions();
      } else if (shownOptions.length > 0) {
        setActive((current) => (current + 1) % shownOptions.length);
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setTyped(false);
        setActive(Math.max(0, options.length - 1));
        setOpen(true);
      } else if (shownOptions.length > 0) {
        setActive(
          (current) => (current - 1 + shownOptions.length) % shownOptions.length
        );
      }
      return;
    }

    if (event.key === "Enter" && open) {
      event.preventDefault();
      const option = shownOptions[active];
      if (option) choose(option);
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
      setTyped(false);
      if (mode === "strict") setText(value);
      return;
    }

    // Blur closes the list after Tab and applies the mode's commit rules.
  }

  const activeId =
    open && shownOptions[active] ? `${listId}-${active}` : undefined;

  return (
    <div className="relative">
      <input
        {...fieldProps}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          controlClassName,
          "h-control-md pr-9 font-mono",
          className
        )}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Show options"
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            showAllOptions();
          }
        }}
      >
        <ChevronDownIcon className="size-4 text-gray-900" />
      </button>
      {open && shownOptions.length > 0 ? (
        <ul
          role="listbox"
          id={listId}
          className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-medium bg-background-100 p-1 shadow-menu"
        >
          {shownOptions.map((option, index) => (
            <li
              key={option.value}
              role="option"
              id={`${listId}-${index}`}
              aria-selected={option.value === value}
              data-active={index === active}
              className="cursor-default rounded-base px-2 py-1.5 text-sm text-gray-1000 data-[active=true]:bg-gray-100"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              <span className="font-mono">{option.value}</span>
              {option.description ? (
                <span className="block truncate text-gray-900">
                  {option.description}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}
