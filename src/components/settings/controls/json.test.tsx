import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { JsonControl } from "./json";

describe("JsonControl", () => {
  test("renders a textarea for JSON input", () => {
    render(<JsonControl value={{ key: "value" }} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeInTheDocument();
  });

  test("formats object values as pretty-printed JSON", () => {
    render(<JsonControl value={{ a: 1, b: 2 }} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toContain('"a": 1');
    expect(textarea.value).toContain('"b": 2');
  });

  test("renders with empty value when undefined", () => {
    render(<JsonControl value={undefined} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
  });

  test("handles array values", () => {
    render(<JsonControl value={[1, 2, 3]} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toContain("1");
    expect(textarea.value).toContain("2");
    expect(textarea.value).toContain("3");
  });

  test("has monospace font class", () => {
    render(<JsonControl value={{ test: true }} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea.className).toContain("font-mono");
  });
});
