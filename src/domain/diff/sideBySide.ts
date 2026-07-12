import type { DiffLine, DiffResult, SideBySideRow } from "./types.ts";

/**
 * Pairs the flat diff line sequence into side-by-side rows: unchanged lines
 * appear on both sides, and each contiguous removed/added block is zipped
 * row by row so nearby edits line up visually.
 */
export function buildSideBySideRows(result: DiffResult): SideBySideRow[] {
  const rows: SideBySideRow[] = [];
  const lines = result.lines;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line) {
      i++;
      continue;
    }
    if (line.type === "unchanged") {
      rows.push({ left: line, right: line });
      i++;
      continue;
    }

    const removed: DiffLine[] = [];
    while (i < lines.length) {
      const current = lines[i];
      if (!current || current.type !== "removed") {
        break;
      }
      removed.push(current);
      i++;
    }
    const added: DiffLine[] = [];
    while (i < lines.length) {
      const current = lines[i];
      if (!current || current.type !== "added") {
        break;
      }
      added.push(current);
      i++;
    }

    const rowCount = Math.max(removed.length, added.length);
    for (let r = 0; r < rowCount; r++) {
      rows.push({ left: removed[r] ?? null, right: added[r] ?? null });
    }
  }

  return rows;
}
