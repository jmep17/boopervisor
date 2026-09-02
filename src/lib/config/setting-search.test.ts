import { describe, expect, test } from "bun:test";
import { matchesQuery, queryTerms } from "./setting-search";

describe("matchesQuery", () => {
  test("an empty query matches everything", () => {
    expect(
      matchesQuery({ key: "permissions.defaultMode" }, queryTerms(""))
    ).toBe(true);
  });

  test("matches the key without regard to case", () => {
    expect(
      matchesQuery(
        { key: "permissions.defaultMode" },
        queryTerms("PERMISSIONS")
      )
    ).toBe(true);
  });

  test("a term may span the dot in the key", () => {
    expect(
      matchesQuery(
        { key: "permissions.defaultMode" },
        queryTerms("defaultmode")
      )
    ).toBe(true);
  });

  test("matches a term found only in the summary", () => {
    expect(
      matchesQuery(
        {
          key: "permissions.defaultMode",
          summary: "Controls whether Claude asks before acting.",
        },
        queryTerms("asks")
      )
    ).toBe(true);
  });

  test("two terms match when one is in the key and the other in the topic", () => {
    expect(
      matchesQuery(
        {
          key: "permissions.defaultMode",
          topic: "Permissions",
        },
        queryTerms("defaultMode permissions")
      )
    ).toBe(true);
  });

  test("a term found in none of key, summary or topic does not match", () => {
    expect(
      matchesQuery(
        {
          key: "permissions.defaultMode",
          summary: "Controls whether Claude asks before acting.",
          topic: "Permissions",
        },
        queryTerms("zzz")
      )
    ).toBe(false);
  });

  test("an uncatalogued entry matches on key only", () => {
    expect(matchesQuery({ key: "someUnknownKey" }, queryTerms("unknown"))).toBe(
      true
    );
    expect(matchesQuery({ key: "someUnknownKey" }, queryTerms("summary"))).toBe(
      false
    );
  });
});
