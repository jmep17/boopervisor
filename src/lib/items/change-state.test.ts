import { describe, expect, test } from "bun:test";

import { USER_SCOPE, type ScopeSelection } from "@/lib/scope/scope";
import { readChangeItemStateForm } from "./change-state";

const PROJECT_SCOPE: ScopeSelection = {
  kind: "project",
  path: "/home/me/project",
};

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

describe("readChangeItemStateForm", () => {
  test("refuses a type that is not mcp, skill or plugin", () => {
    for (const type of ["junk", "", "agent"]) {
      const result = readChangeItemStateForm(
        form({ type, name: "foo", state: "enabled" }),
        USER_SCOPE
      );
      expect(result).toEqual({
        ok: false,
        error: "That is not a kind of item Boopervisor manages.",
      });
    }
  });

  test("refuses an empty name", () => {
    const result = readChangeItemStateForm(
      form({ type: "mcp", name: "", state: "enabled" }),
      USER_SCOPE
    );
    expect(result).toEqual({ ok: false, error: "No item named." });
  });

  test("refuses a state outside enabled/disabled/archived", () => {
    const result = readChangeItemStateForm(
      form({ type: "mcp", name: "foo", state: "junk" }),
      USER_SCOPE
    );
    expect(result).toEqual({
      ok: false,
      error: "That is not a state an item can be in.",
    });
  });

  test("accepts each of the three states", () => {
    for (const state of ["enabled", "disabled", "archived"]) {
      const result = readChangeItemStateForm(
        form({ type: "skill", name: "foo", state }),
        USER_SCOPE
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state).toBe(state as never);
    }
  });

  test("keeps source only when it is user, project or local", () => {
    for (const source of ["user", "project", "local"]) {
      const result = readChangeItemStateForm(
        form({ type: "mcp", name: "foo", state: "enabled", source }),
        USER_SCOPE
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.source).toBe(source as never);
    }
  });

  test("drops a junk source to undefined", () => {
    const result = readChangeItemStateForm(
      form({ type: "mcp", name: "foo", state: "enabled", source: "junk" }),
      USER_SCOPE
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBeUndefined();
  });

  test("a missing source is undefined", () => {
    const result = readChangeItemStateForm(
      form({ type: "mcp", name: "foo", state: "enabled" }),
      USER_SCOPE
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBeUndefined();
  });

  test("derives scope project and location.projectRoot from a project selection", () => {
    const result = readChangeItemStateForm(
      form({ type: "mcp", name: "foo", state: "enabled" }),
      PROJECT_SCOPE
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scope).toBe("project");
    expect(result.location).toEqual({ projectRoot: "/home/me/project" });
  });

  test("derives scope user and undefined location.projectRoot from the user selection", () => {
    const result = readChangeItemStateForm(
      form({ type: "mcp", name: "foo", state: "enabled" }),
      USER_SCOPE
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scope).toBe("user");
    expect(result.location).toEqual({ projectRoot: undefined });
  });

  test("decodes both expected-file tokens", () => {
    const result = readChangeItemStateForm(
      form({
        type: "mcp",
        name: "foo",
        state: "enabled",
        expectedSettings: "123:abc",
        expectedArchive: "456:def",
      }),
      USER_SCOPE
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.expectedSettings).toEqual({ mtimeMs: 123, hash: "abc" });
    expect(result.expectedArchive).toEqual({ mtimeMs: 456, hash: "def" });
  });

  test("a missing token decodes to the never-matching { hash: '', mtimeMs: -1 }", () => {
    const result = readChangeItemStateForm(
      form({ type: "mcp", name: "foo", state: "enabled" }),
      USER_SCOPE
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.expectedSettings).toEqual({ hash: "", mtimeMs: -1 });
    expect(result.expectedArchive).toEqual({ hash: "", mtimeMs: -1 });
  });
});
