import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

function ConfirmDialog({ open }: { open: boolean }) {
  return (
    <Dialog open={open}>
      <DialogTrigger>Restore</DialogTrigger>
      <DialogContent>
        <DialogTitle>Restore this backup?</DialogTitle>
        <DialogDescription>
          The current file is backed up first.
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}

describe("Dialog", () => {
  test("shows nothing but its trigger while closed", () => {
    render(<ConfirmDialog open={false} />);
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("names and describes itself when open", () => {
    render(<ConfirmDialog open />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Restore this backup?");
    expect(dialog).toHaveAccessibleDescription(
      "The current file is backed up first."
    );
  });

  test("keeps itself inside the window and scrolls when taller than it", () => {
    render(<ConfirmDialog open />);
    const className = screen.getByRole("dialog").className;
    expect(className).toContain("max-h-[calc(100dvh-2rem)]");
    expect(className).toContain("overflow-y-auto");
    expect(className).toContain("w-[calc(100%-2rem)]");
  });
});
