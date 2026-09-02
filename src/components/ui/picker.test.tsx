import { describe, expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { Field } from "./field";
import { Picker, type PickerOption } from "./picker";

const options: PickerOption[] = [
  { value: "low", description: "Use less effort" },
  { value: "high", description: "Use more effort" },
  { value: "xhigh", description: "Use extended effort" },
];

function Harness({
  mode = "strict",
  onSubmit,
}: {
  mode?: "strict" | "free";
  onSubmit?: () => void;
}) {
  const [value, setValue] = useState("high");
  return (
    <form onSubmit={onSubmit}>
      <Field label="Effort">
        <Picker
          name="value"
          mode={mode}
          value={value}
          onValueChange={setValue}
          options={options}
        />
      </Field>
    </form>
  );
}

function hiddenValue(): string {
  return (
    document.querySelector(
      'input[type="hidden"][name="value"]'
    ) as HTMLInputElement
  ).value;
}

describe("Picker", () => {
  test("is labelled by its field and shows the value", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Effort");
    expect(input).toHaveRole("combobox");
    expect(input).toHaveValue("high");
  });

  test("lists every option on ArrowDown, with descriptions", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText("Effort"), "{ArrowDown}");
    expect(screen.getAllByRole("option")).toHaveLength(options.length);
    expect(screen.getByText("Use extended effort")).toBeInTheDocument();
  });

  test("filters as you type", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("Effort");
    await user.clear(input);
    await user.type(input, "xh");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option")).toHaveTextContent("xhigh");
  });

  test("chooses with Enter and carries the value in the hidden field", async () => {
    const user = userEvent.setup();
    const onSubmit = mock(() => {});
    render(<Harness onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Effort");
    await user.type(input, "{ArrowDown}{ArrowDown}{Enter}");
    expect(hiddenValue()).toBe("high");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("strict mode reverts text that is not an option on blur", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("Effort");
    await user.clear(input);
    await user.type(input, "nope");
    await user.tab();
    expect(input).toHaveValue("high");
    expect(hiddenValue()).toBe("high");
  });

  test("strict mode accepts an option typed in another case", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("Effort");
    await user.clear(input);
    await user.type(input, "XHIGH");
    await user.tab();
    expect(hiddenValue()).toBe("xhigh");
    expect(input).toHaveValue("xhigh");
  });

  test("free mode keeps whatever is typed", async () => {
    const user = userEvent.setup();
    render(<Harness mode="free" />);
    const input = screen.getByLabelText("Effort");
    await user.clear(input);
    await user.type(input, "claude-opus-5");
    await user.tab();
    expect(hiddenValue()).toBe("claude-opus-5");
  });

  test("an empty value unsets in strict mode", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("Effort");
    await user.clear(input);
    await user.tab();
    expect(hiddenValue()).toBe("");
  });

  test("aria-activedescendant follows the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("Effort");
    await user.type(input, "{ArrowDown}");
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      screen.getAllByRole("option")[0].id
    );
    await user.type(input, "{ArrowDown}");
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      screen.getAllByRole("option")[1].id
    );
  });
});
