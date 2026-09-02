import { describe, expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ItemStateControls, type ItemStateAction } from "./item-state-controls";

describe("ItemStateControls", () => {
  test("submits the target state with the identifying fields", async () => {
    const action = mock<ItemStateAction>(async () => ({}));
    render(
      <ItemStateControls
        state="enabled"
        action={action}
        fields={{ item: "skill", name: "tdd", expected: "tok" }}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Archive" }));

    const [[, formData]] = action.mock.calls;
    expect(formData.get("state")).toBe("archived");
    expect(formData.get("item")).toBe("skill");
    expect(formData.get("name")).toBe("tdd");
    expect(formData.get("expected")).toBe("tok");
  });

  test("disables the current state's button", () => {
    const action = mock<ItemStateAction>(async () => ({}));
    render(
      <ItemStateControls
        state="enabled"
        action={action}
        fields={{ item: "skill", name: "tdd", expected: "tok" }}
      />
    );

    expect(screen.getByRole("button", { name: "Enable" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Disable" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Archive" })).not.toBeDisabled();
  });

  test("locks every button when a higher scope decides", () => {
    const action = mock<ItemStateAction>(async () => ({}));
    render(
      <ItemStateControls
        state="enabled"
        action={action}
        fields={{ item: "skill", name: "tdd", expected: "tok" }}
        lockedReason="Set by managed settings."
      />
    );

    expect(screen.getByRole("button", { name: "Enable" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Disable" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Archive" })).toBeDisabled();
    expect(screen.getByText("Set by managed settings.")).toBeInTheDocument();
  });

  test("shows the server's error", async () => {
    const action = mock<ItemStateAction>(async () => ({
      error: "Stale write refused.",
    }));
    render(
      <ItemStateControls
        state="enabled"
        action={action}
        fields={{ item: "skill", name: "tdd", expected: "tok" }}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Archive" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Stale write refused."
    );
  });
});
