import { beforeEach, describe, expect, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  FilterableSettings,
  type FilterableRow,
  type FilterableTopic,
} from "./filterable-settings";

const topics: FilterableTopic[] = [
  {
    topic: "Permissions",
    rows: [
      row("permissions.defaultMode", "Choose what Claude may do."),
      row("permissions.verboseMode", "Show detailed output."),
    ],
  },
  {
    topic: "Model and responses",
    rows: [row("effortLevel", "How much reasoning to use.")],
  },
];

const uncatalogued = [row("mysterySetting")];
const keys = [
  "permissions.defaultMode",
  "permissions.verboseMode",
  "effortLevel",
  "mysterySetting",
];

function row(key: string, summary?: string): FilterableRow {
  return {
    key,
    summary,
    node: <div data-testid={key}>{key}</div>,
  };
}

function renderSettings(initialQuery = "", file?: "project" | "local") {
  return render(
    <FilterableSettings
      topics={topics}
      uncatalogued={uncatalogued}
      initialQuery={initialQuery}
      file={file}
    />
  );
}

function sectionNamed(name: string): HTMLElement {
  const section = screen.getByText(name).closest("section");
  if (!section) throw new Error(`No section contains ${name}`);
  return section;
}

describe("FilterableSettings", () => {
  beforeEach(() => {
    window.location.href = "http://localhost/settings";
  });

  test("shows every row and the total when the query is empty", () => {
    renderSettings();

    for (const key of keys) expect(screen.getByTestId(key)).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("4 settings");
  });

  test("hides rows and topics that do not match, and counts the rest", async () => {
    renderSettings();

    await userEvent.type(screen.getByRole("searchbox"), "verbose");

    expect(screen.getByTestId("permissions.verboseMode")).toBeVisible();
    expect(screen.getByTestId("permissions.defaultMode")).not.toBeVisible();
    expect(screen.getByTestId("effortLevel")).not.toBeVisible();
    expect(screen.getByTestId("mysterySetting")).not.toBeVisible();
    expect(sectionNamed("Model and responses")).not.toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 of 4 settings match"
    );
  });

  test("matches on the summary and the topic, not only the key", async () => {
    renderSettings();

    await userEvent.type(screen.getByRole("searchbox"), "reasoning");

    expect(screen.getByTestId("effortLevel")).toBeVisible();
    expect(screen.getByTestId("permissions.defaultMode")).not.toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 of 4 settings match"
    );

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    await userEvent.type(screen.getByRole("searchbox"), "model");

    expect(screen.getByTestId("effortLevel")).toBeVisible();
    expect(screen.getByTestId("permissions.verboseMode")).not.toBeVisible();
  });

  test("filters uncatalogued keys by name", async () => {
    renderSettings();

    await userEvent.type(screen.getByRole("searchbox"), "mystery");

    expect(screen.getByTestId("mysterySetting")).toBeVisible();
    expect(sectionNamed("Uncatalogued")).toBeVisible();
    expect(sectionNamed("Permissions")).not.toBeVisible();
    expect(sectionNamed("Model and responses")).not.toBeVisible();
  });

  test("says when nothing matches and clears", async () => {
    renderSettings();

    await userEvent.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText('No setting matches "zzz".')).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    for (const key of keys) expect(screen.getByTestId(key)).toBeVisible();
    expect(screen.queryByText(/No setting matches/)).toBeNull();
  });

  test("keeps the query and other parameters in the URL", async () => {
    window.location.href = "http://localhost/settings?file=local";
    renderSettings();

    await userEvent.type(screen.getByRole("searchbox"), "verbose");
    await waitFor(() =>
      expect(window.location.search).toBe("?file=local&q=verbose")
    );

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(window.location.search).toBe("?file=local"));
  });

  test("keeps the query when switching settings files", async () => {
    renderSettings("", "project");

    await userEvent.type(screen.getByRole("searchbox"), "verbose mode");

    expect(screen.getByRole("link", { name: /Project-local/ })).toHaveAttribute(
      "href",
      "/settings?file=local&q=verbose+mode"
    );
  });

  test("starts from the query in the URL", () => {
    renderSettings("verbose");

    expect(screen.getByRole("searchbox")).toHaveValue("verbose");
    expect(screen.getByTestId("permissions.verboseMode")).toBeVisible();
    expect(screen.getByTestId("permissions.defaultMode")).not.toBeVisible();
    expect(screen.getByTestId("effortLevel")).not.toBeVisible();
    expect(screen.getByTestId("mysterySetting")).not.toBeVisible();
  });
});
