import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { JsonControl } from "./json";

describe("JsonControl", () => {
  test("shows the value as JSON", () => {
    render(<JsonControl value={{ FOO: "bar" }} />);
    expect(screen.getByRole("textbox")).toHaveValue('{\n  "FOO": "bar"\n}');
  });

  test("refuses text that is not JSON, so the form will not submit it", async () => {
    const user = userEvent.setup();
    render(<JsonControl value={undefined} />);

    const editor = screen.getByRole("textbox") as HTMLTextAreaElement;
    // user-event reads `{` as a key descriptor, so a literal brace is doubled.
    await user.type(editor, "{{not json");

    expect(editor.checkValidity()).toBe(false);
    expect(screen.getByRole("alert")).toHaveTextContent(/Not valid JSON/);
  });

  test("accepts JSON, and accepts empty, which unsets the key", async () => {
    const user = userEvent.setup();
    render(<JsonControl value={undefined} />);

    const editor = screen.getByRole("textbox") as HTMLTextAreaElement;
    await user.type(editor, '{{"a":1}');
    expect(editor.checkValidity()).toBe(true);

    await user.clear(editor);
    expect(editor.checkValidity()).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
