import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { TextControl } from "./text";

describe("TextControl", () => {
  test("renders an input field", () => {
    render(<TextControl value="hello" />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("hello");
  });

  test("renders with empty value when undefined", () => {
    render(<TextControl value={undefined} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  test("has text input type", () => {
    render(<TextControl value="test" />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.type).toBe("text");
  });
});
