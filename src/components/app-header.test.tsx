import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { AppHeaderNav, NAV_ITEMS } from "./app-header";

describe("AppHeaderNav", () => {
  test("links to every route in the shell", () => {
    render(<AppHeaderNav pathname="/settings" />);
    for (const item of NAV_ITEMS) {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute(
        "href",
        item.href,
      );
    }
  });

  test("marks the current route and only the current route", () => {
    render(<AppHeaderNav pathname="/skills" />);
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual(["Skills"]);
  });

  test("marks the current route from a nested path", () => {
    render(<AppHeaderNav pathname="/mcp/some-server" />);
    expect(screen.getByRole("link", { name: "MCP" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("marks nothing when the path is outside the shell", () => {
    render(<AppHeaderNav pathname="/" />);
    expect(
      screen.getAllByRole("link").filter((l) => l.hasAttribute("aria-current")),
    ).toHaveLength(0);
  });
});
