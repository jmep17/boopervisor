import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PermissionRulesControl } from "./permission-rules";

/** What the hidden field would submit. */
function hiddenValue(): string {
  return (
    document.querySelector(
      'input[type="hidden"][name="value"]'
    ) as HTMLInputElement
  ).value;
}

describe("PermissionRulesControl", () => {
  test("renders the rules on disk", () => {
    render(
      <PermissionRulesControl value={["Bash", "Read(./.env)"]} list="allow" />
    );
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue("Bash");
    expect(inputs[1]).toHaveValue("Read(./.env)");
  });

  test("renders empty for an unset key", () => {
    render(<PermissionRulesControl value={undefined} list="allow" />);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(hiddenValue()).toBe("[]");
  });

  test("says where its list sits in the evaluation order", () => {
    render(<PermissionRulesControl value={undefined} list="deny" />);
    expect(
      screen.getByText(/Deny rules are checked first/)
    ).toBeInTheDocument();
  });

  test("submits a JSON array, dropping blank rules", async () => {
    const user = userEvent.setup();
    render(<PermissionRulesControl value={["Bash"]} list="allow" />);

    await user.click(screen.getByRole("button", { name: /add rule/i }));

    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(JSON.parse(hiddenValue())).toEqual(["Bash"]);
  });

  test("flags a rule the syntax refuses", async () => {
    const user = userEvent.setup();
    render(<PermissionRulesControl value={[""]} list="allow" />);

    const input = screen.getByRole("textbox", { name: "Rule 1" });
    await user.type(input, "Bash(");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Invalid syntax/)).toBeInTheDocument();
    // The server is the final judge, so the text still travels.
    expect(JSON.parse(hiddenValue())).toEqual(["Bash("]);
  });

  test("removes a rule", async () => {
    const user = userEvent.setup();
    render(
      <PermissionRulesControl value={["Bash", "PowerShell"]} list="allow" />
    );

    const removeButtons = screen.getAllByRole("button", {
      name: /remove rule/i,
    });
    await user.click(removeButtons[0]);

    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toHaveValue("PowerShell");
    expect(JSON.parse(hiddenValue())).toEqual(["PowerShell"]);
  });

  test("reorders rules with the move buttons", async () => {
    const user = userEvent.setup();
    render(
      <PermissionRulesControl value={["Bash", "PowerShell"]} list="allow" />
    );

    await user.click(screen.getAllByRole("button", { name: /move down/i })[0]);

    const inputs = screen.getAllByRole("textbox");
    expect(inputs[0]).toHaveValue("PowerShell");
    expect(inputs[1]).toHaveValue("Bash");
    expect(JSON.parse(hiddenValue())).toEqual(["PowerShell", "Bash"]);
  });
});
