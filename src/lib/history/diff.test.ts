import { describe, expect, test } from "bun:test";
import { diffText } from "./diff";

describe("diffText", () => {
  test("returns empty array for identical text", () => {
    const text = "line 1\nline 2\nline 3";
    expect(diffText(text, text)).toEqual([]);
  });

  test("shows all lines as adds when before is empty", () => {
    const result = diffText("", "line 1\nline 2");
    expect(result.map((d) => ({ type: d.type, text: d.text }))).toEqual([
      { type: "add", text: "line 1" },
      { type: "add", text: "line 2" },
    ]);
  });

  test("shows all lines as removes when after is empty", () => {
    const result = diffText("line 1\nline 2", "");
    expect(result.map((d) => ({ type: d.type, text: d.text }))).toEqual([
      { type: "remove", text: "line 1" },
      { type: "remove", text: "line 2" },
    ]);
  });

  test("shows changes in the middle with context", () => {
    const before = "line 1\nline 2\nline 3\nline 4\nline 5";
    const after = "line 1\nline 2b\nline 2c\nline 3\nline 4\nline 5";
    const result = diffText(before, after);

    const types = result.map((d) => d.type);
    expect(types).toContain("remove");
    expect(types).toContain("add");
    expect(types).toContain("context");
  });

  test("handles single line changes", () => {
    const before = "hello world";
    const after = "hello universe";
    const result = diffText(before, after);

    const types = result.map((d) => d.type);
    const texts = result.map((d) => d.text);
    expect(types).toContain("remove");
    expect(types).toContain("add");
    expect(texts).toContain("hello world");
    expect(texts).toContain("hello universe");
  });

  test("handles additions at the end", () => {
    const before = "line 1\nline 2";
    const after = "line 1\nline 2\nline 3";
    const result = diffText(before, after);

    expect(result.map((d) => d.type)).toContain("add");
    expect(result.some((d) => d.type === "add" && d.text === "line 3")).toBe(
      true
    );
  });

  test("handles deletions at the start", () => {
    const before = "line 1\nline 2\nline 3";
    const after = "line 2\nline 3";
    const result = diffText(before, after);

    expect(result.map((d) => d.type)).toContain("remove");
    expect(result.some((d) => d.type === "remove" && d.text === "line 1")).toBe(
      true
    );
  });

  test("preserves context around changes", () => {
    const before = "a\nb\nc\nd\ne\nf\ng\nh\ni";
    const after = "a\nb\nc\nX\nd\ne\nf\ng\nh\ni";
    const result = diffText(before, after);

    // Should show context lines around the change
    const contextLines = result
      .filter((d) => d.type === "context")
      .map((d) => d.text);
    expect(contextLines.length).toBeGreaterThan(0);
  });

  test("handles JSON-like content", () => {
    const before = '{\n  "key": "old"\n}';
    const after = '{\n  "key": "new"\n}';
    const result = diffText(before, after);

    expect(result.length).toBeGreaterThan(0);
    expect(result.some((d) => d.type === "remove")).toBe(true);
    expect(result.some((d) => d.type === "add")).toBe(true);
  });

  test("handles large identical prefixes and suffixes efficiently", () => {
    const before =
      Array(100).fill("context line").join("\n") +
      "\nchanged from this\n" +
      Array(100).fill("more context").join("\n");
    const after =
      Array(100).fill("context line").join("\n") +
      "\nchanged to this\n" +
      Array(100).fill("more context").join("\n");

    const result = diffText(before, after);
    // Should be a manageable size, not showing all 200 context lines
    expect(result.length).toBeLessThan(100);
  });
});
