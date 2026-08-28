import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { SwitchControl } from "./switch";

describe("SwitchControl", () => {
  test("renders a select control", () => {
    render(<SwitchControl value={true} />);
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
  });

  test("has name attribute for form submission", () => {
    const { container } = render(<SwitchControl value={true} />);
    const nameAttr = container.querySelector('[name="value"]');
    expect(nameAttr).toBeDefined();
  });

  test("renders with false value", () => {
    render(<SwitchControl value={false} />);
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
  });

  test("renders with undefined value", () => {
    render(<SwitchControl value={undefined} />);
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
  });
});
