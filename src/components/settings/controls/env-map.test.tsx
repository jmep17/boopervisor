import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnvMapControl } from "./env-map";

function hiddenValue(): string {
  return (
    document.querySelector(
      'input[type="hidden"][name="value"]'
    ) as HTMLInputElement
  ).value;
}

describe("EnvMapControl", () => {
  test("renders one row per variable with name and value", () => {
    render(
      <EnvMapControl
        value={{ API_TIMEOUT_MS: "1200000", FOO: "bar" }}
        variables={[]}
      />
    );

    expect(
      screen.getByRole("combobox", { name: "Variable 1 name" })
    ).toHaveValue("API_TIMEOUT_MS");
    expect(
      screen.getByRole("combobox", { name: "Variable 2 name" })
    ).toHaveValue("FOO");
    expect(
      screen.getByRole("textbox", { name: "Variable 1 value" })
    ).toHaveValue("1200000");
    expect(
      screen.getByRole("textbox", { name: "Variable 2 value" })
    ).toHaveValue("bar");
  });

  test("shows the documented purpose under a known name, with the reference link", () => {
    render(
      <EnvMapControl
        value={{ API_TIMEOUT_MS: "1200000" }}
        variables={[
          {
            value: "API_TIMEOUT_MS",
            description: "Timeout for API requests in milliseconds",
          },
        ]}
      />
    );

    expect(
      screen.getByText("Timeout for API requests in milliseconds")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "env-vars#variables" })
    ).toHaveAttribute(
      "href",
      "https://code.claude.com/docs/en/env-vars#variables"
    );
  });

  test("says when a name is not in the reference", () => {
    render(<EnvMapControl value={{ FOO: "bar" }} variables={[]} />);
    expect(
      screen.getByText(/Not in Claude Code's environment variables reference/)
    ).toBeInTheDocument();
  });

  test("offers the documented names while typing", async () => {
    const user = userEvent.setup();
    render(
      <EnvMapControl
        value={{ FOO: "bar" }}
        variables={[{ value: "API_TIMEOUT_MS", description: "Timeout" }]}
      />
    );
    const input = screen.getByRole("combobox", { name: "Variable 1 name" });
    await user.clear(input);
    await user.type(input, "API");
    await user.type(input, "{ArrowDown}");
    expect(
      screen.getByRole("option", { name: /API_TIMEOUT_MS/ })
    ).toBeInTheDocument();
  });

  test("submits the map as JSON, dropping unnamed rows", async () => {
    const user = userEvent.setup();
    const original = { FOO: "bar" };
    render(<EnvMapControl value={original} variables={[]} />);
    await user.click(screen.getByRole("button", { name: "Add variable" }));
    expect(JSON.parse(hiddenValue())).toEqual(original);
  });

  test("flags a duplicate name", async () => {
    const user = userEvent.setup();
    render(<EnvMapControl value={{ FOO: "one" }} variables={[]} />);
    await user.click(screen.getByRole("button", { name: "Add variable" }));
    await user.type(
      screen.getByRole("combobox", { name: "Variable 2 name" }),
      "FOO"
    );
    await user.type(
      screen.getByRole("textbox", { name: "Variable 2 value" }),
      "two"
    );
    expect(
      screen.getByRole("combobox", { name: "Variable 2 name" })
    ).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByText("Set twice above; the last value wins.")
    ).toBeInTheDocument();
    expect(JSON.parse(hiddenValue())).toEqual({ FOO: "two" });
  });

  test("every input has its own id", () => {
    render(
      <EnvMapControl
        value={{ ONE: "1", TWO: "2", THREE: "3" }}
        variables={[]}
      />
    );
    const ids = [
      ...screen.getAllByRole("combobox"),
      ...screen.getAllByRole("textbox"),
    ].map((input) => input.id);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
  });

  test("an empty map submits {}", () => {
    render(<EnvMapControl value={undefined} variables={[]} />);
    expect(hiddenValue()).toBe("{}");
  });
});
