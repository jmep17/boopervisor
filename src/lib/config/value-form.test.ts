import { describe, expect, test } from "bun:test";

import { getSetting } from "@/lib/catalog";
import { parseValueForSetting } from "./value-form";

const booleanKey = getSetting("verbose")!;
const stringKey = getSetting("model")!;

describe("parseValueForSetting", () => {
  test("reads a switch's form value as a boolean", () => {
    expect(parseValueForSetting("true", booleanKey)).toEqual({
      ok: true,
      value: true,
    });
    expect(parseValueForSetting("false", booleanKey)).toEqual({
      ok: true,
      value: false,
    });
  });

  test("an empty Boolean submission leaves the key unset rather than writing false", () => {
    expect(parseValueForSetting("", booleanKey)).toEqual({
      ok: true,
      value: undefined,
    });
  });

  test("an empty string unsets a string key rather than writing an empty one", () => {
    expect(parseValueForSetting("", stringKey)).toEqual({
      ok: true,
      value: undefined,
    });
  });

  test("refuses text that is not the number it claims to be", () => {
    const definition = { ...stringKey, valueType: "number" as const };
    expect(parseValueForSetting("12", definition)).toEqual({
      ok: true,
      value: 12,
    });
    expect(parseValueForSetting("twelve", definition).ok).toBe(false);
  });

  test("an uncatalogued key is read as JSON, and malformed JSON is refused", () => {
    expect(parseValueForSetting('{"a":1}', undefined)).toEqual({
      ok: true,
      value: { a: 1 },
    });
    expect(parseValueForSetting("{a:1}", undefined).ok).toBe(false);
  });

  test("unset removes the key whatever the field holds", () => {
    expect(parseValueForSetting("true", booleanKey, true)).toEqual({
      ok: true,
      value: undefined,
    });
  });
});
