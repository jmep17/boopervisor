import { describe, expect, test } from "bun:test";
import {
  USER_SCOPE,
  decodeScope,
  encodeScope,
  mergeProjectPaths,
  projectLabel,
  sameScope,
  scopeLabel,
  scopeOptions,
  parseManualProjects,
  serializeManualProjects,
} from "./scope";

describe("encodeScope / decodeScope", () => {
  test("round-trips the user scope", () => {
    expect(decodeScope(encodeScope(USER_SCOPE))).toEqual(USER_SCOPE);
  });

  test("round-trips a project scope, including a path holding a colon", () => {
    const scope = { kind: "project", path: "/Users/x/src/a:b" } as const;
    expect(decodeScope(encodeScope(scope))).toEqual(scope);
  });

  test("falls back to the user scope for anything unreadable", () => {
    for (const value of [undefined, "", "nonsense", "project:", "project"]) {
      expect(decodeScope(value)).toEqual(USER_SCOPE);
    }
  });

  test("falls back to the user scope for a relative project path", () => {
    expect(decodeScope("project:src/boopervisor")).toEqual(USER_SCOPE);
  });
});

describe("sameScope", () => {
  test("compares kind and path", () => {
    const a = { kind: "project", path: "/a" } as const;
    expect(sameScope(a, { kind: "project", path: "/a" })).toBe(true);
    expect(sameScope(a, { kind: "project", path: "/b" })).toBe(false);
    expect(sameScope(a, USER_SCOPE)).toBe(false);
    expect(sameScope(USER_SCOPE, USER_SCOPE)).toBe(true);
  });
});

describe("labels", () => {
  test("a project is named by its directory", () => {
    expect(projectLabel("/Users/x/src/boopervisor")).toBe("boopervisor");
    expect(projectLabel("/Users/x/src/boopervisor/")).toBe("boopervisor");
    expect(projectLabel("/")).toBe("/");
  });

  test("the user scope has a fixed label", () => {
    expect(scopeLabel(USER_SCOPE)).toBe("User");
    expect(scopeLabel({ kind: "project", path: "/Users/x/src/a" })).toBe("a");
  });
});

describe("mergeProjectPaths", () => {
  test("keeps configured and manual paths, marking where each came from", () => {
    expect(mergeProjectPaths(["/b"], ["/a"])).toEqual([
      { path: "/a", label: "a", source: "manual" },
      { path: "/b", label: "b", source: "claude-json" },
    ]);
  });

  test("a manually added path already in ~/.claude.json is listed once, as configured", () => {
    expect(mergeProjectPaths(["/a"], ["/a"])).toEqual([
      { path: "/a", label: "a", source: "claude-json" },
    ]);
  });

  test("drops duplicates, blanks and relative paths", () => {
    expect(mergeProjectPaths(["/a", "/a", "", "  ", "rel"], [])).toEqual([
      { path: "/a", label: "a", source: "claude-json" },
    ]);
  });

  test("orders by label, then by path", () => {
    expect(
      mergeProjectPaths(["/z/app", "/a/app", "/b"], []).map((p) => p.path)
    ).toEqual(["/a/app", "/z/app", "/b"]);
  });
});

describe("scopeOptions", () => {
  test("lists the user scope first, then every project", () => {
    const options = scopeOptions(mergeProjectPaths(["/x/api"], ["/y/web"]));
    expect(options).toEqual([
      { value: "user", label: "User" },
      {
        value: "project:/x/api",
        label: "api",
        detail: "/x/api",
        source: "claude-json",
      },
      {
        value: "project:/y/web",
        label: "web",
        detail: "/y/web",
        source: "manual",
      },
    ]);
  });

  test("lists the user scope even when there are no projects", () => {
    expect(scopeOptions([])).toEqual([{ value: "user", label: "User" }]);
  });
});

describe("manual projects storage", () => {
  test("round-trips the added directories", () => {
    expect(parseManualProjects(serializeManualProjects(["/a", "/b"]))).toEqual([
      "/a",
      "/b",
    ]);
  });

  test("reads anything unrecognised as none added", () => {
    for (const value of [undefined, "", "{", "{}", '["/a",3]']) {
      expect(parseManualProjects(value)).toEqual(
        value === '["/a",3]' ? ["/a"] : []
      );
    }
  });
});
