import { describe, expect, it } from "vite-plus/test";
import { codeBlockLineSet, parseHeadings, toAnalyzableDocument } from "./markdown.ts";

describe("parseHeadings", () => {
  it("dedupes repeated heading text the way GitHub suffixes anchors", () => {
    const doc = toAnalyzableDocument("## Setup\n\nText.\n\n## Setup\n\nMore text.\n\n## Setup\n");
    const headings = parseHeadings(doc);
    expect(headings.map((h) => h.slug)).toEqual(["setup", "setup-1", "setup-2"]);
  });

  it("assigns distinct slugs to distinct headings", () => {
    const doc = toAnalyzableDocument("## Setup\n\n## Usage\n");
    const headings = parseHeadings(doc);
    expect(headings.map((h) => h.slug)).toEqual(["setup", "usage"]);
  });
});

describe("heading and fence edge cases (bug hunt)", () => {
  it("strips closed-ATX sequences and keeps unicode in slugs", () => {
    const doc = toAnalyzableDocument("# Setup #\n\n## Café setup\n");
    expect(parseHeadings(doc).map((h) => h.slug)).toEqual(["setup", "café-setup"]);
  });
  it("parses setext headings but not frontmatter closers", () => {
    const doc = toAnalyzableDocument("Setup\n=====\n\nDetails\n-------\n");
    expect(parseHeadings(doc).map((h) => [h.text, h.level])).toEqual([
      ["Setup", 1],
      ["Details", 2],
    ]);
    const withFrontmatter = toAnalyzableDocument("---\nname: x\n---\n# Real\n");
    expect(parseHeadings(withFrontmatter).map((h) => h.text)).toEqual(["Real"]);
  });
  it("does not close fences on info strings or shorter fences", () => {
    const doc = toAnalyzableDocument(
      "````\ncode\n```js\nmore code\n```\nstill code\n````\nprose\n",
    );
    const code = codeBlockLineSet(doc);
    expect([1, 2, 3, 4, 5, 6, 7].every((n) => code.has(n))).toBe(true);
    expect(code.has(8)).toBe(false);
  });
  it("treats indented blocks after a blank line as code", () => {
    const doc = toAnalyzableDocument(
      "Intro paragraph.\n\n    code example\n    more code\n\nBack to prose.\n",
    );
    const code = codeBlockLineSet(doc);
    expect(code.has(3)).toBe(true);
    expect(code.has(4)).toBe(true);
    expect(code.has(6)).toBe(false);
  });
});

describe("list-relative indented code (review round 4)", () => {
  it("does not treat list continuation paragraphs as code", () => {
    const doc = toAnalyzableDocument("- Follow this reference:\n\n    [Read](missing.md)\n");
    expect(codeBlockLineSet(doc).has(3)).toBe(false);
    const nested = toAnalyzableDocument("- Item:\n\n        code inside list\n");
    expect(codeBlockLineSet(nested).has(3)).toBe(true);
    const tabbed = toAnalyzableDocument("Intro.\n\n\tcode example\n");
    expect(codeBlockLineSet(tabbed).has(3)).toBe(true);
  });
});
