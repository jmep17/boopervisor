import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SelectControl } from "./select";

describe("SelectControl", () => {
  test("shows the value", () => {
    render(
      <SelectControl value="low" enumValues={["low", "medium", "high"]} />
    );
    expect(screen.getByRole("combobox")).toHaveValue("low");
  });

  test("lists its options on ArrowDown", async () => {
    const user = userEvent.setup();
    render(
      <SelectControl value="low" enumValues={["low", "medium", "high"]} />
    );
    await user.type(screen.getByRole("combobox"), "{ArrowDown}");
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  test("refuses text outside its options", async () => {
    const user = userEvent.setup();
    render(
      <SelectControl value="low" enumValues={["low", "medium", "high"]} />
    );
    const input = screen.getByRole("combobox");
    await user.clear(input);
    await user.type(input, "other");
    await user.tab();
    expect(input).toHaveValue("low");
  });

  test("submits under the value name", () => {
    const { container } = render(
      <form>
        <SelectControl value="high" enumValues={["low", "medium", "high"]} />
      </form>
    );
    expect(
      container.querySelector('input[type="hidden"][name="value"]')
    ).not.toBeNull();
  });
});
