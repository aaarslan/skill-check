import { describe, expect, it } from "vite-plus/test";
import { diffLines } from "./diffLines.ts";

describe("diffLines", () => {
  it("reports identical files with no added/removed lines", () => {
    const result = diffLines("line one\nline two\n", "line one\nline two\n");
    expect(result.identical).toBe(true);
    expect(result.addedCount).toBe(0);
    expect(result.removedCount).toBe(0);
    expect(result.lines.every((line) => line.type === "unchanged")).toBe(true);
  });

  it("detects purely added lines", () => {
    const result = diffLines("a\nb\n", "a\nb\nc\n");
    expect(result.identical).toBe(false);
    expect(result.addedCount).toBe(1);
    expect(result.removedCount).toBe(0);
    const added = result.lines.find((line) => line.type === "added");
    expect(added?.text).toBe("c");
    expect(added?.candidateLineNumber).toBe(3);
    expect(added?.originalLineNumber).toBeNull();
  });

  it("detects purely removed lines", () => {
    const result = diffLines("a\nb\nc\n", "a\nb\n");
    expect(result.addedCount).toBe(0);
    expect(result.removedCount).toBe(1);
    const removed = result.lines.find((line) => line.type === "removed");
    expect(removed?.text).toBe("c");
    expect(removed?.originalLineNumber).toBe(3);
    expect(removed?.candidateLineNumber).toBeNull();
  });

  it("detects a modified line as a remove+add pair", () => {
    const result = diffLines("hello world", "hello there");
    expect(result.addedCount).toBe(1);
    expect(result.removedCount).toBe(1);
    expect(result.lines.map((line) => line.type)).toEqual(["removed", "added"]);
  });

  it("treats empty content as a single empty line and diffs it correctly", () => {
    const result = diffLines("", "");
    expect(result.identical).toBe(true);
    expect(result.lines).toHaveLength(1);
  });

  it("handles one side being empty against non-empty content", () => {
    const result = diffLines("", "new content\n");
    expect(result.addedCount).toBeGreaterThan(0);
  });

  it("ignores whitespace differences when the option is set", () => {
    const withWhitespace = diffLines("hello   world\n", "hello world\n", {
      ignoreWhitespace: false,
    });
    expect(withWhitespace.identical).toBe(false);

    const ignoringWhitespace = diffLines("hello   world\n", "hello world\n", {
      ignoreWhitespace: true,
    });
    expect(ignoringWhitespace.identical).toBe(true);
  });

  it("preserves the original text even when ignoring whitespace for comparison", () => {
    const result = diffLines("hello   world\n", "hello world\n", { ignoreWhitespace: true });
    expect(result.lines[0]?.text).toBe("hello   world");
  });
});
