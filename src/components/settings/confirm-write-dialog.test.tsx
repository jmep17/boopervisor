import { describe, expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ConfirmWriteDialog } from "./confirm-write-dialog";

describe("ConfirmWriteDialog", () => {
  test("names the key in its title", () => {
    render(
      <ConfirmWriteDialog
        open
        onOpenChange={() => {}}
        settingKey="hooks"
        onConfirm={() => {}}
      />
    );
    expect(
      screen.getByRole("dialog", { name: "Write hooks?" })
    ).toBeInTheDocument();
  });

  test("shows the catalog's reason", () => {
    render(
      <ConfirmWriteDialog
        open
        onOpenChange={() => {}}
        settingKey="hooks"
        reason="Structured, event-keyed, and executes shell commands."
        onConfirm={() => {}}
      />
    );
    expect(
      screen.getByText("Structured, event-keyed, and executes shell commands.")
    ).toBeInTheDocument();
  });

  test("clicking Write it calls onConfirm once", async () => {
    const user = userEvent.setup();
    const onConfirm = mock(() => {});
    render(
      <ConfirmWriteDialog
        open
        onOpenChange={() => {}}
        settingKey="hooks"
        onConfirm={onConfirm}
      />
    );
    await user.click(screen.getByRole("button", { name: "Write it" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test("clicking Cancel calls onOpenChange(false)", async () => {
    const user = userEvent.setup();
    const onOpenChange = mock(() => {});
    render(
      <ConfirmWriteDialog
        open
        onOpenChange={onOpenChange}
        settingKey="hooks"
        onConfirm={() => {}}
      />
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
