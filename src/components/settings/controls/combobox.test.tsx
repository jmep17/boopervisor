import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { ComboboxControl } from "./combobox";

describe("ComboboxControl", () => {
  test("renders a combobox input field", () => {
    render(<ComboboxControl value="custom" suggestions={["foo", "bar"]} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("custom");
  });

  test("renders empty when value is undefined", () => {
    render(<ComboboxControl value={undefined} suggestions={["foo", "bar"]} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  test("creates a datalist with suggestions", () => {
    const { container } = render(
      <ComboboxControl value="test" suggestions={["foo", "bar", "baz"]} />
    );
    const datalist = container.querySelector("datalist");
    expect(datalist).toBeInTheDocument();
    const options = datalist?.querySelectorAll("option");
    expect(options?.length).toBe(3);
  });

  test("does not render datalist when no suggestions", () => {
    const { container } = render(
      <ComboboxControl value="test" suggestions={[]} />
    );
    const datalist = container.querySelector("datalist");
    expect(datalist).not.toBeInTheDocument();
  });

  test("shows placeholder when optionSource is provided", () => {
    render(
      <ComboboxControl value="test" suggestions={[]} optionSource="models" />
    );
    const input = screen.getByRole("combobox") as HTMLInputElement;
    expect(input.placeholder).toContain("Resolved from");
  });
});
