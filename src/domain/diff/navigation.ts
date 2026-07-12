import type { ChangeGroup, DiffLine, SideBySideRow } from "./types.ts";

/** Groups contiguous runs of non-unchanged diff lines, for jump-to-next-change navigation. */
export function findChangeGroups(lines: readonly DiffLine[]): ChangeGroup[] {
  const groups: ChangeGroup[] = [];
  let start: number | null = null;

  lines.forEach((line, index) => {
    if (line.type !== "unchanged") {
      if (start === null) {
        start = index;
      }
      return;
    }
    if (start !== null) {
      groups.push({ startIndex: start, endIndex: index - 1 });
      start = null;
    }
  });
  if (start !== null) {
    groups.push({ startIndex: start, endIndex: lines.length - 1 });
  }
  return groups;
}

/** Same grouping, over side-by-side rows (a row is a change if either side differs). */
export function findSideBySideChangeGroups(rows: readonly SideBySideRow[]): ChangeGroup[] {
  const groups: ChangeGroup[] = [];
  let start: number | null = null;

  rows.forEach((row, index) => {
    const isChange = row.left?.type !== "unchanged" || row.right?.type !== "unchanged";
    if (isChange) {
      if (start === null) {
        start = index;
      }
      return;
    }
    if (start !== null) {
      groups.push({ startIndex: start, endIndex: index - 1 });
      start = null;
    }
  });
  if (start !== null) {
    groups.push({ startIndex: start, endIndex: rows.length - 1 });
  }
  return groups;
}
