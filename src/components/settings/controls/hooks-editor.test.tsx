import { describe, expect, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
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
  test("renders hook events from the catalog when value is undefined", () => {
    render(<HooksEditorControl value={undefined} />);
    expect(screen.getByText("SessionStart")).toBeInTheDocument();
    expect(screen.getByText("UserPromptSubmit")).toBeInTheDocument();
    expect(screen.getAllByText(/No hooks configured/).length).toBeGreaterThan(
      0
    );
  });

  test("shows the command from a documented value in a textbox", () => {
    render(
      <HooksEditorControl
        value={{
          SessionStart: [
            { hooks: [{ type: "command", command: "/path/to/setup.sh" }] },
          ],
        }}
      />
    );

    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs.some((i) => i.value === "/path/to/setup.sh")).toBe(true);
  });

  test("editing the command updates the hidden field to the nested shape", async () => {
    const user = userEvent.setup();
    render(
      <HooksEditorControl
        value={{
          SessionStart: [
            { hooks: [{ type: "command", command: "/before.sh" }] },
          ],
        }}
      />
    );

    const command = screen.getByPlaceholderText("The command Claude Code runs");
    await user.clear(command);
    await user.type(command, "/bin/echo hi");

    expect(JSON.parse(hiddenValue())).toEqual({
      SessionStart: [{ hooks: [{ type: "command", command: "/bin/echo hi" }] }],
    });
  });

  test("Add group then Add command hook then typing a command yields a nested group", async () => {
    const user = userEvent.setup();
    render(<HooksEditorControl value={undefined} />);

    const sessionStartHeading = screen.getByText("SessionStart");
    const sessionStartSection = sessionStartHeading.closest(
      "div.flex.flex-col"
    ) as HTMLElement;
    const addGroupButton = within(sessionStartSection).getByRole("button", {
      name: /add group/i,
    });
    await user.click(addGroupButton);

    const addHookButton = within(sessionStartSection).getByRole("button", {
      name: /add command hook/i,
    });
    await user.click(addHookButton);

    const command = within(sessionStartSection).getByPlaceholderText(
      "The command Claude Code runs"
    );
    await user.type(command, "/bin/echo hi");

    const submitted = JSON.parse(hiddenValue());
    expect(submitted.SessionStart[0].hooks[0]).toEqual({
      type: "command",
      command: "/bin/echo hi",
    });
  });

  test("a prompt hook is shown read-only and survives untouched", async () => {
    const user = userEvent.setup();
    render(
      <HooksEditorControl
        value={{
          Stop: [
            {
              hooks: [
                { type: "command", command: "/before.sh" },
                { type: "prompt", prompt: "Check", model: "haiku" },
              ],
            },
          ],
        }}
      />
    );

    expect(screen.getByText(/A prompt hook/)).toBeInTheDocument();

    const command = screen.getByPlaceholderText("The command Claude Code runs");
    await user.clear(command);
    await user.type(command, "/after.sh");

    const submitted = JSON.parse(hiddenValue());
    expect(submitted.Stop[0].hooks[1]).toEqual({
      type: "prompt",
      prompt: "Check",
      model: "haiku",
    });
    expect(submitted.Stop[0].hooks[0]).toEqual({
      type: "command",
      command: "/after.sh",
    });
  });

  test("regression: an unparseable value renders the JSON fallback with the original value", () => {
    const value = { SessionStart: [{ matcher: "", command: "/x.sh" }] };
    render(<HooksEditorControl value={value} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    const textarea = document.querySelector(
      'textarea[name="value"]'
    ) as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(JSON.parse(textarea.value)).toEqual(value);
    expect(
      document.querySelector('input[type="hidden"][name="value"]')
    ).not.toBeInTheDocument();
  });

  test("an unknown event in the value is rendered with the Not in the catalog badge", () => {
    render(
      <HooksEditorControl
        value={{
          SomethingNew: [{ hooks: [{ type: "command", command: "/x.sh" }] }],
        }}
      />
    );

    expect(screen.getByText("SomethingNew")).toBeInTheDocument();
    expect(screen.getByText("Not in the catalog")).toBeInTheDocument();
  });
});
