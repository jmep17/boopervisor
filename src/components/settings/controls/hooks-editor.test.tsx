import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HooksEditorControl } from "./hooks-editor";

/** What the hidden field would submit. */
function hiddenValue(): string {
  return (
    document.querySelector(
      'input[type="hidden"][name="value"]'
    ) as HTMLInputElement
  ).value;
}

describe("HooksEditorControl", () => {
  test("renders hook events from the catalog", () => {
    render(<HooksEditorControl value={undefined} />);
    expect(screen.getByText("SessionStart")).toBeInTheDocument();
    expect(screen.getByText("UserPromptSubmit")).toBeInTheDocument();
  });

  test("initializes with parsed hooks object", () => {
    const value = {
      SessionStart: [{ matcher: "", command: "/path/to/setup.sh" }],
    };
    render(<HooksEditorControl value={value} />);

    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs.some((i) => i.value === "/path/to/setup.sh")).toBe(true);
  });

  test("renders empty when value is undefined", () => {
    render(<HooksEditorControl value={undefined} />);
    // Should have event sections but no entries
    expect(screen.getByText("SessionStart")).toBeInTheDocument();
    expect(screen.getAllByText(/No hooks configured/).length).toBeGreaterThan(
      0
    );
  });

  test("adds new hook entries when Add button is clicked", async () => {
    const user = userEvent.setup();
    render(<HooksEditorControl value={undefined} />);

    // Find the Add hook button for SessionStart
    const sessionStartSection = screen.getByText("SessionStart").closest("div");
    const addButton = sessionStartSection!.querySelector(
      'button[type="button"]'
    ) as HTMLButtonElement;
    await user.click(addButton);

    // Should now have a matcher input visible
    expect(
      screen.getByPlaceholderText("Optional pattern match")
    ).toBeInTheDocument();
  });

  test("removes hook entries when remove button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <HooksEditorControl
        value={{
          SessionStart: [{ matcher: "pattern", command: "/path/to/script.sh" }],
        }}
      />
    );

    // Verify matcher is there initially
    expect(screen.getByDisplayValue("pattern")).toBeInTheDocument();

    const removeButton = screen.getByRole("button", { name: /remove hook/i });
    await user.click(removeButton);

    // The matcher input should be gone
    expect(screen.queryByDisplayValue("pattern")).not.toBeInTheDocument();
  });

  test("edits matcher when text is typed", async () => {
    const user = userEvent.setup();
    render(
      <HooksEditorControl
        value={{
          UserPromptSubmit: [
            { matcher: "deploy", command: "/path/to/deploy.sh" },
          ],
        }}
      />
    );

    const matcherInput = screen.getByPlaceholderText(
      "Optional pattern match"
    ) as HTMLInputElement;
    await user.clear(matcherInput);
    await user.type(matcherInput, "test");

    const submitted = JSON.parse(hiddenValue());
    expect(submitted.UserPromptSubmit[0].matcher).toBe("test");
  });

  test("names the script a command runs, which Boopervisor never writes", () => {
    render(
      <HooksEditorControl
        value={{
          SessionStart: [{ matcher: "", command: "/path/to/script.sh" }],
        }}
      />
    );

    expect(screen.getByText(/\/path\/to\/script\.sh/)).toBeInTheDocument();
    expect(screen.getByText(/never writes that file/)).toBeInTheDocument();
  });

  test("the command itself is edited here, so a hook added here can run something", async () => {
    const user = userEvent.setup();
    render(
      <HooksEditorControl
        value={{ SessionStart: [{ matcher: "", command: "" }] }}
      />
    );

    const command = screen.getByPlaceholderText("The command Claude Code runs");
    await user.type(command, "/bin/echo hi");

    expect(JSON.parse(hiddenValue()).SessionStart[0].command).toBe(
      "/bin/echo hi"
    );
  });

  test("carries the whole structure to the server as JSON", () => {
    render(
      <HooksEditorControl
        value={{
          SessionStart: [{ matcher: "", command: "/path/to/setup.sh" }],
          UserPromptSubmit: [
            { matcher: "deploy", command: "/path/to/deploy.sh" },
          ],
        }}
      />
    );

    const submitted = JSON.parse(hiddenValue());
    expect(submitted.SessionStart).toBeDefined();
    expect(submitted.SessionStart[0].command).toBe("/path/to/setup.sh");
    expect(submitted.UserPromptSubmit[0].matcher).toBe("deploy");
  });

  test("omits events with no hooks from the submitted value", () => {
    render(
      <HooksEditorControl
        value={{
          SessionStart: [{ matcher: "", command: "/path/to/setup.sh" }],
        }}
      />
    );

    const submitted = JSON.parse(hiddenValue());
    expect(submitted.SessionStart).toBeDefined();
    expect(submitted.UserPromptSubmit).toBeUndefined();
  });
});
