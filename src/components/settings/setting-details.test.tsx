import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";

import { getSetting, SETTINGS } from "@/lib/catalog";
import { SettingDetails } from "./setting-details";

describe("SettingDetails", () => {
  test("shows the Type and Default text", () => {
    const definition = getSetting("autoCompactWindow")!;
    render(<SettingDetails definition={definition} />);
    expect(screen.getByText(/number of tokens, from/)).toBeInTheDocument();
    expect(
      screen.getByText(/unset, so Claude Code picks a window tuned/)
    ).toBeInTheDocument();
  });

  test("shows the For one session row for a key the reference documents, with code spans rendered", () => {
    const definition = getSetting("autoCompactWindow")!;
    render(<SettingDetails definition={definition} />);
    expect(screen.getByText("For one session")).toBeInTheDocument();
    const code = screen.getByText("--autocompact");
    expect(code.tagName).toBe("CODE");
  });

  test("omits the For one session row when the reference gives none", () => {
    const definition = SETTINGS.find((s) => !s.perSessionOverrides)!;
    expect(definition).toBeDefined();
    render(<SettingDetails definition={definition} />);
    expect(screen.queryByText("For one session")).toBeNull();
  });

  test("links to the reference, opening in a new tab", () => {
    const definition = getSetting("verbose")!;
    render(<SettingDetails definition={definition} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", definition.docUrl);
    expect(link).toHaveAttribute("target", "_blank");
  });
});
