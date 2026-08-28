import { describe, expect, test } from "bun:test";

import {
  deleteAtPath,
  getAtPath,
  hasAtPath,
  setAtPath,
  settingPaths,
} from "./paths";
import { getSetting } from "@/lib/catalog";

/** A container like `permissions` is described but not settable, so it is walked into. */
const describes = (key: string) => {
  const setting = getSetting(key);
  return Boolean(setting && !setting.virtual);
};

describe("addressing a nested key", () => {
  const content = { permissions: { allow: ["Bash"] }, model: "opus" };

  test("finds a key inside its container", () => {
    expect(getAtPath(content, "permissions.allow")).toEqual(["Bash"]);
    expect(hasAtPath(content, "permissions.allow")).toBe(true);
  });

  test("a missing step is a missing key, not a crash", () => {
    expect(getAtPath({}, "permissions.allow")).toBeUndefined();
    expect(
      hasAtPath({ permissions: "not an object" }, "permissions.allow")
    ).toBe(false);
  });

  test("a key holding undefined is still present", () => {
    expect(
      hasAtPath({ permissions: { allow: undefined } }, "permissions.allow")
    ).toBe(true);
  });
});

describe("writing a nested key", () => {
  test("creates the container when it is not there", () => {
    expect(setAtPath({ model: "opus" }, "permissions.allow", ["Bash"])).toEqual(
      {
        model: "opus",
        permissions: { allow: ["Bash"] },
      }
    );
  });

  test("leaves its siblings, and the caller's object, untouched", () => {
    const content = { permissions: { deny: ["Bash"], allow: [] } };
    const next = setAtPath(content, "permissions.allow", ["Read"]);

    expect(next).toEqual({ permissions: { deny: ["Bash"], allow: ["Read"] } });
    expect(content.permissions.allow).toEqual([]);
  });

  test("removing the last key in a container removes the container", () => {
    expect(
      deleteAtPath(
        { permissions: { allow: [] }, model: "opus" },
        "permissions.allow"
      )
    ).toEqual({
      model: "opus",
    });
  });

  test("removing a key that is not there changes nothing", () => {
    const content = { model: "opus" };
    expect(deleteAtPath(content, "permissions.allow")).toEqual(content);
  });
});

describe("settingPaths", () => {
  test("names nested keys the way the catalog does", () => {
    const paths = settingPaths(
      { permissions: { allow: [], deny: [] }, model: "opus" },
      describes
    );
    expect(paths.sort()).toEqual([
      "model",
      "permissions.allow",
      "permissions.deny",
    ]);
  });

  test("a key the catalog describes whole is not walked into", () => {
    // `env` is one setting whose value happens to be an object.
    expect(settingPaths({ env: { FOO: "bar" } }, describes)).toEqual(["env"]);
  });

  test("an object the catalog says nothing about is one uncatalogued key", () => {
    expect(settingPaths({ somethingNew: { a: 1 } }, describes)).toEqual([
      "somethingNew.a",
    ]);
    expect(settingPaths({ somethingNew: {} }, describes)).toEqual([
      "somethingNew",
    ]);
  });
});
