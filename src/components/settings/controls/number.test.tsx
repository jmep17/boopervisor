import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { NumberControl } from "./number";

describe("NumberControl", () => {
  test("renders a number input field", () => {
    render(<NumberControl value={42} />);
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("42");
  });

  test("renders with empty value when undefined", () => {
    render(<NumberControl value={undefined} />);
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  test("displays negative numbers", () => {
    render(<NumberControl value={-10} />);
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(input.value).toBe("-10");
  });

  test("displays decimal numbers", () => {
    render(<NumberControl value={3.14} />);
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(input.value).toBe("3.14");
  });
});
