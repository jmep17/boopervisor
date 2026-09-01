import { describe, expect, test } from "bun:test";
import { USER_SCOPE } from "@/lib/scope/scope";
import { editingScopeFor, parseProjectFile } from "./editing-scope";

describe("editingScopeFor", () => {
  test("the user scope always writes user, whatever file is asked for", () => {
    expect(editingScopeFor(USER_SCOPE, "project")).toBe("user");
    expect(editingScopeFor(USER_SCOPE, "local")).toBe("user");
  });

  test("a project scope writes to the file the page chose", () => {
    const project = { kind: "project", path: "/a" } as const;
    expect(editingScopeFor(project, "project")).toBe("project");
    expect(editingScopeFor(project, "local")).toBe("local");
  });
});

describe("parseProjectFile", () => {
  test("maps 'local' to local", () => {
    expect(parseProjectFile("local")).toBe("local");
  });

  test("everything else reads as the project's own file", () => {
    for (const value of [undefined, "x", ["local"]]) {
      expect(parseProjectFile(value)).toBe("project");
    }
  });
});
