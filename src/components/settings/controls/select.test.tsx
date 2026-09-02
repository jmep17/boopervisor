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
    // Radix renders its native field only inside a form, which is where the control lives.
    const { container } = render(
      <form>
        <SelectControl value="high" enumValues={["low", "medium", "high"]} />
      </form>
    );
    const selectRoot = container.querySelector('[name="value"]');
    expect(selectRoot).not.toBeNull();
  });

  test("handles single enum value", () => {
    render(<SelectControl value="only" enumValues={["only"]} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  test("handles empty enum values list", () => {
    render(<SelectControl value="" enumValues={[]} />);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });
});
