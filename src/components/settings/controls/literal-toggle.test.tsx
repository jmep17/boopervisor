import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LiteralToggleControl } from "./literal-toggle";

describe("LiteralToggleControl", () => {
  test("renders a checkbox with a label", () => {
    render(<LiteralToggleControl value="disable" literal="disable" />);
    const checkbox = screen.getByRole("checkbox");
    const label = screen.getByText("disable");
    expect(checkbox).toBeInTheDocument();
    expect(label).toBeInTheDocument();
  });

  test("is checked when value matches the literal", () => {
    render(<LiteralToggleControl value="disable" literal="disable" />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("data-state", "checked");
  });

  test("is unchecked when value is undefined", () => {
    render(<LiteralToggleControl value={undefined} literal="disable" />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("data-state", "unchecked");
  });

  test("is unchecked when value does not match literal", () => {
    render(<LiteralToggleControl value="enabled" literal="disable" />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("data-state", "unchecked");
  });

  test("displays the literal string as label", () => {
    render(<LiteralToggleControl value={undefined} literal="disabled" />);
    expect(screen.getByText("disabled")).toBeInTheDocument();
  });

  test("submits the literal when checked", () => {
    render(<LiteralToggleControl value="disable" literal="disable" />);
    const hidden = document.querySelector(
      'input[type="hidden"][name="value"]'
    ) as HTMLInputElement;
    expect(hidden.value).toBe("disable");
  });

  test("submits nothing when unchecked", async () => {
    const user = userEvent.setup();
    render(<LiteralToggleControl value={undefined} literal="disable" />);
    const hidden = document.querySelector(
      'input[type="hidden"][name="value"]'
    ) as HTMLInputElement;
    expect(hidden.value).toBe("");

    await user.click(screen.getByRole("checkbox"));
    expect(hidden.value).toBe("disable");
  });
});
