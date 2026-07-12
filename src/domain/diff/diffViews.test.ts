import { describe, expect, it } from "vite-plus/test";
import { diffLines } from "./diffLines.ts";
import { findChangeGroups, findSideBySideChangeGroups } from "./navigation.ts";
import { buildSideBySideRows } from "./sideBySide.ts";

describe("buildSideBySideRows", () => {
  it("pairs unchanged lines on both sides", () => {
    const diff = diffLines("a\nb", "a\nb");
    const rows = buildSideBySideRows(diff);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.left?.type).toBe("unchanged");
    expect(rows[0]?.right?.type).toBe("unchanged");
  });

  it("zips a removed/added block into rows instead of stacking them separately", () => {
    const diff = diffLines("old line", "new line");
    const rows = buildSideBySideRows(diff);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.left?.type).toBe("removed");
    expect(rows[0]?.right?.type).toBe("added");
  });

  it("leaves the shorter side blank when block sizes differ", () => {
    const diff = diffLines("a\n", "a\nb\nc\n");
    const rows = buildSideBySideRows(diff);
    const addedOnlyRow = rows.find((row) => row.left === null && row.right?.type === "added");
    expect(addedOnlyRow).toBeDefined();
  });
});

describe("findChangeGroups", () => {
  it("groups contiguous non-unchanged lines into a single change group", () => {
    const diff = diffLines("a\nold\nold2\nb\n", "a\nnew\nnew2\nb\n");
    const groups = findChangeGroups(diff.lines);
    expect(groups).toHaveLength(1);
  });

  it("returns no groups for identical content", () => {
    const diff = diffLines("a\nb\n", "a\nb\n");
    expect(findChangeGroups(diff.lines)).toHaveLength(0);
  });
});

describe("findSideBySideChangeGroups", () => {
  it("groups contiguous changed rows", () => {
    const diff = diffLines("a\nold\nb\n", "a\nnew\nb\n");
    const rows = buildSideBySideRows(diff);
    const groups = findSideBySideChangeGroups(rows);
    expect(groups).toHaveLength(1);
  });
});
