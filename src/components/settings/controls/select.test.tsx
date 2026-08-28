import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { SelectControl } from "./select";

describe("SelectControl", () => {
  test("renders a select control", () => {
    render(
      <SelectControl value="low" enumValues={["low", "medium", "high"]} />
    );
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
  });

  test("has name attribute for form submission", () => {
    const { container } = render(
      <SelectControl value="high" enumValues={["low", "medium", "high"]} />
    );
    const selectRoot = container.querySelector('[name="value"]');
    expect(selectRoot).toBeDefined();
  });

  test("handles single enum value", () => {
    render(<SelectControl value="only" enumValues={["only"]} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  test("handles empty enum values list", () => {
    render(<SelectControl value="" enumValues={[]} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
