import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComboboxControl } from "./combobox";

describe("ComboboxControl", () => {
  test("shows the value", () => {
    render(<ComboboxControl value="custom" suggestions={["foo", "bar"]} />);
    expect(screen.getByRole("combobox")).toHaveValue("custom");
  });

  test("lists its suggestions on ArrowDown", async () => {
    const user = userEvent.setup();
    render(<ComboboxControl value="custom" suggestions={["foo", "bar"]} />);
    await user.type(screen.getByRole("combobox"), "{ArrowDown}");
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  test("accepts free text", async () => {
    const user = userEvent.setup();
    render(<ComboboxControl value="custom" suggestions={["foo", "bar"]} />);
    const input = screen.getByRole("combobox");
    await user.clear(input);
    await user.type(input, "anything");
    await user.tab();
    expect(input).toHaveValue("anything");
  });

  test("submits under the value name", () => {
    const { container } = render(
      <form>
        <ComboboxControl value="test" suggestions={["foo", "bar"]} />
      </form>
    );
    expect(
      container.querySelector('input[type="hidden"][name="value"]')
    ).not.toBeNull();
  });
});
