import { describe, expect, it } from "vite-plus/test";
import { parseHeadings, toAnalyzableDocument } from "./markdown.ts";

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
