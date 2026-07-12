import { describe, expect, it } from "vite-plus/test";
import { analyzeQuality } from "./analyze.ts";

describe("analyzeQuality", () => {
  it("scores a well-formed skill document highly", () => {
    const content = `---
name: Example Skill
description: Helps the user format markdown documents consistently
---

Use this skill when the user asks to format a markdown file.

## Steps

- Run the formatter on the input file.
- Check that headings use consistent casing.
- Verify that the output has no trailing whitespace.

## Constraints

- Do not modify code blocks.
- Never rewrite the user's prose content.

## Error handling

If the input is invalid Markdown, ask the user to fix it before proceeding.
`;
    const report = analyzeQuality(content);
    expect(report.score).toBeGreaterThanOrEqual(80);
  });

  it("scores a minimal, unstructured document lower", () => {
    const report = analyzeQuality("Do stuff with the file.\n");
    expect(report.score).toBeLessThan(90);
    expect(report.findings.length).toBeGreaterThan(0);
  });

  it("never returns a score outside 0-100 and always covers every category", () => {
    const report = analyzeQuality("");
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.categoryScores).toHaveLength(5);
  });

  it("does not throw on malformed or empty input", () => {
    expect(() => analyzeQuality("")).not.toThrow();
    expect(() => analyzeQuality("```\nunclosed code fence")).not.toThrow();
  });
});
