import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { Button, buttonVariants } from "./button";

describe("Button", () => {
  test("renders its label as a button", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  test("is disabled when asked", () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  test("becomes the child element with asChild, keeping its styling", () => {
    render(
      <Button asChild>
        <a href="/settings">Settings</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Settings" });
    expect(link).toHaveAttribute("href", "/settings");
    expect(link.className).toContain("rounded-base");
  });

  test("dresses itself only in Geist tokens", () => {
    for (const variant of ["primary", "secondary", "ghost", "danger"] as const) {
      const className = buttonVariants({ variant });
      expect(className).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(className).not.toMatch(/\b(?:bg|text|border)-(?:zinc|slate|neutral|stone)-/);
    }
  });
});
