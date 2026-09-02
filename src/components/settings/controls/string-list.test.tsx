import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StringListControl } from "./string-list";

/** What the one hidden field would submit. */
function hiddenValue(): string {
  return (
    document.querySelector(
      'input[type="hidden"][name="value"]'
    ) as HTMLInputElement
  ).value;
}

describe("StringListControl", () => {
  test("renders input fields for each entry", () => {
    render(<StringListControl value={["foo", "bar"]} />);
    const inputs = screen.getAllByRole("textbox");
    // Two visible inputs for entries + one hidden value field
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  test("initializes with array values", () => {
    render(<StringListControl value={["foo", "bar", "baz"]} />);
    const inputs = screen.getAllByRole("textbox");
    expect(inputs[0]).toHaveValue("foo");
    expect(inputs[1]).toHaveValue("bar");
    expect(inputs[2]).toHaveValue("baz");
  });

  test("renders empty when value is undefined", () => {
    render(<StringListControl value={undefined} />);
    const inputs = screen.queryAllByRole("textbox");
    // Should not have any visible inputs when empty
    expect(inputs.length).toBe(0);
    // But should have the hidden value field
    const hiddenInput = document.querySelector(
      'input[type="hidden"][name="value"]'
    ) as HTMLInputElement;
    expect(hiddenInput).toBeInTheDocument();
  });

  test("adds new entries when Add Entry button is clicked", async () => {
    const user = await userEvent.setup();
    render(<StringListControl value={["first"]} />);

    let inputs = screen.getAllByRole("textbox");
    expect(inputs.length).toBe(1); // First entry

    const addButton = screen.getByRole("button", { name: /add entry/i });
    await user.click(addButton);

    inputs = screen.getAllByRole("textbox");
    // Should have first entry + new empty entry
    expect(inputs.length).toBe(2);
  });

  test("edits entries when text is typed", async () => {
    const user = await userEvent.setup();
    render(<StringListControl value={["initial"]} />);

    const inputs = screen.getAllByRole("textbox");
    const input = inputs[0]; // First visible input (not the hidden field)
    await user.clear(input);
    await user.type(input, "updated");

    expect(input).toHaveValue("updated");
  });

  test("removes entries when remove button is clicked", async () => {
    const user = await userEvent.setup();
    render(<StringListControl value={["foo", "bar", "baz"]} />);

    const removeButtons = screen.getAllByRole("button", {
      name: /remove entry/i,
    });
    // Remove the middle entry
    await user.click(removeButtons[1]);

    const inputs = screen.getAllByRole("textbox");
    expect(inputs[0]).toHaveValue("foo");
    expect(inputs[1]).toHaveValue("baz");
  });

  test("reorders entries with move up/down buttons", async () => {
    const user = await userEvent.setup();
    render(<StringListControl value={["first", "second", "third"]} />);

    const moveDownButtons = screen.getAllByRole("button", {
      name: /move down/i,
    });
    // Move first entry down
    await user.click(moveDownButtons[0]);

    const inputs = screen.getAllByRole("textbox");
    expect(inputs[0]).toHaveValue("second");
    expect(inputs[1]).toHaveValue("first");
    expect(inputs[2]).toHaveValue("third");
  });

  test("carries the whole list to the server as JSON in one field", () => {
    render(<StringListControl value={["foo", "bar", "baz"]} />);

    expect(hiddenValue()).toBe('["foo","bar","baz"]');
  });

  test("an entry holding a newline or a comma stays one entry", async () => {
    const user = userEvent.setup();
    render(<StringListControl value={["one,two", "three"]} />);

    const inputs = screen.getAllByRole("textbox");
    await user.clear(inputs[1]);
    await user.type(inputs[1], "three four");

    // The value the form carries parses back to exactly the entries shown, whatever they hold.
    expect(JSON.parse(hiddenValue())).toEqual(["one,two", "three four"]);
  });

  test("offers suggestions for each entry", async () => {
    const user = userEvent.setup();
    render(
      <StringListControl
        value={["fable", "opus"]}
        suggestions={[{ value: "fable" }, { value: "opus" }]}
      />
    );

    const inputs = screen.getAllByRole("combobox");
    expect(inputs).toHaveLength(2);
    await user.type(inputs[0], "{ArrowDown}");
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  test("every entry input has its own id", () => {
    render(<StringListControl value={["one", "two", "three"]} />);
    const ids = screen.getAllByRole("textbox").map((input) => input.id);
    expect(new Set(ids).size).toBe(3);
  });
});
