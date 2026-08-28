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
  test("renders three separate list sections", () => {
    render(<PermissionRulesControl value={undefined} />);
    expect(screen.getByText("Deny (checked first)")).toBeInTheDocument();
    expect(screen.getByText("Ask (checked second)")).toBeInTheDocument();
    expect(screen.getByText("Allow (checked last)")).toBeInTheDocument();
  });

  test("initializes with parsed permissions object", () => {
    const value = {
      allow: ["Bash", "Read(./.env)"],
      ask: ["WebFetch"],
      deny: ["PowerShell"],
    };
    render(<PermissionRulesControl value={value} />);

    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs.some((i) => i.value === "Bash")).toBe(true);
    expect(inputs.some((i) => i.value === "Read(./.env)")).toBe(true);
    expect(inputs.some((i) => i.value === "WebFetch")).toBe(true);
    expect(inputs.some((i) => i.value === "PowerShell")).toBe(true);
  });

  test("renders empty when value is undefined", () => {
    render(<PermissionRulesControl value={undefined} />);
    const inputs = screen.queryAllByRole("textbox") as HTMLInputElement[];
    // All inputs should be empty
    expect(inputs.every((i) => i.value === "")).toBe(true);
  });

  test("adds new rules when Add buttons are clicked", async () => {
    const user = userEvent.setup();
    render(<PermissionRulesControl value={undefined} />);

    const addAllowButton = screen.getByRole("button", { name: /add allow/i });
    await user.click(addAllowButton);

    const addAskButton = screen.getByRole("button", { name: /add ask/i });
    await user.click(addAskButton);

    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    // Should have at least one input in allow and one in ask
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  test("removes rules when remove button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <PermissionRulesControl value={{ allow: ["Bash", "PowerShell"] }} />
    );

    const removeButtons = screen.getAllByRole("button", {
      name: /remove rule/i,
    });
    await user.click(removeButtons[0]);

    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs.some((i) => i.value === "PowerShell")).toBe(true);
    expect(inputs.some((i) => i.value === "Bash")).toBe(false);
  });

  test("reorders rules with move up/down buttons", async () => {
    const user = userEvent.setup();
    render(
      <PermissionRulesControl value={{ allow: ["Bash", "PowerShell"] }} />
    );

    const moveDownButton = screen.getAllByRole("button", {
      name: /move down/i,
    })[0];
    await user.click(moveDownButton);

    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    const allowInputs = inputs.slice(0, 2); // First two are the allow rules
    expect(allowInputs[0].value).toBe("PowerShell");
    expect(allowInputs[1].value).toBe("Bash");
  });

  test("carries the whole structure to the server as JSON", () => {
    render(
      <PermissionRulesControl
        value={{
          allow: ["Bash"],
          ask: ["WebFetch"],
          deny: ["PowerShell"],
        }}
      />
    );

    const submitted = JSON.parse(hiddenValue());
    expect(submitted.allow).toEqual(["Bash"]);
    expect(submitted.ask).toEqual(["WebFetch"]);
    expect(submitted.deny).toEqual(["PowerShell"]);
  });

  test("omits empty lists from the submitted value", () => {
    render(
      <PermissionRulesControl
        value={{
          allow: ["Bash"],
        }}
      />
    );

    const submitted = JSON.parse(hiddenValue());
    expect(submitted.allow).toBeDefined();
    expect(submitted.ask).toBeUndefined();
    expect(submitted.deny).toBeUndefined();
  });
});
