import type { DiffLine, DiffOptions, DiffResult } from "./types.ts";

type EditOp =
  | { readonly type: "equal"; readonly aIndex: number; readonly bIndex: number }
  | { readonly type: "delete"; readonly aIndex: number }
  | { readonly type: "insert"; readonly bIndex: number };

/**
 * Computes a minimal line-level diff using Myers' O(ND) shortest-edit-script
 * algorithm. Pure and side-effect free: same input always yields the same
 * edit script, independent of any UI state.
 */
export function diffLines(
  originalContent: string,
  candidateContent: string,
  options: DiffOptions = { ignoreWhitespace: false },
): DiffResult {
  const originalLines = originalContent.split("\n");
  const candidateLines = candidateContent.split("\n");
  const compareKey = options.ignoreWhitespace ? normalizeWhitespace : (line: string) => line;
  const a = originalLines.map(compareKey);
  const b = candidateLines.map(compareKey);

  const ops = diffOps(a, b);

  const lines: DiffLine[] = ops.map((op) => diffLineFromOp(op, originalLines, candidateLines));
  const addedCount = lines.reduce((count, line) => count + (line.type === "added" ? 1 : 0), 0);
  const removedCount = lines.reduce((count, line) => count + (line.type === "removed" ? 1 : 0), 0);

  return {
    lines,
    addedCount,
    removedCount,
    identical: addedCount === 0 && removedCount === 0,
  };
}

function diffLineFromOp(
  op: EditOp,
  originalLines: readonly string[],
  candidateLines: readonly string[],
): DiffLine {
  switch (op.type) {
    case "equal":
      return {
        type: "unchanged",
        originalLineNumber: op.aIndex + 1,
        candidateLineNumber: op.bIndex + 1,
        text: originalLines[op.aIndex] ?? "",
      };
    case "delete":
      return {
        type: "removed",
        originalLineNumber: op.aIndex + 1,
        candidateLineNumber: null,
        text: originalLines[op.aIndex] ?? "",
      };
    case "insert":
      return {
        type: "added",
        originalLineNumber: null,
        candidateLineNumber: op.bIndex + 1,
        text: candidateLines[op.bIndex] ?? "",
      };
  }
}

function normalizeWhitespace(line: string): string {
  return line.trim().replace(/\s+/gu, " ");
}

/** Computes the shortest edit script turning `a` into `b`. */
function diffOps(a: readonly string[], b: readonly string[]): EditOp[] {
  const n = a.length;
  const m = b.length;
  if (n === 0 && m === 0) {
    return [];
  }

  const max = n + m;
  const offset = max;
  const v: number[] = Array.from({ length: 2 * max + 1 }, () => 0);
  const trace: number[][] = [];

  let found = false;
  for (let d = 0; d <= max && !found; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && (v[offset + k - 1] ?? 0) < (v[offset + k + 1] ?? 0))) {
        x = v[offset + k + 1] ?? 0;
      } else {
        x = (v[offset + k - 1] ?? 0) + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = true;
        break;
      }
    }
  }

  return backtrack(n, m, trace);
}

function backtrack(n: number, m: number, trace: readonly number[][]): EditOp[] {
  const max = n + m;
  const offset = max;
  let x = n;
  let y = m;
  const ops: EditOp[] = [];

  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d];
    if (!v) {
      continue;
    }
    const k = x - y;
    const prevK =
      k === -d || (k !== d && (v[offset + k - 1] ?? 0) < (v[offset + k + 1] ?? 0)) ? k + 1 : k - 1;
    const prevX = v[offset + prevK] ?? 0;
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      ops.push({ type: "equal", aIndex: x - 1, bIndex: y - 1 });
      x--;
      y--;
    }
    if (d > 0) {
      if (x === prevX) {
        ops.push({ type: "insert", bIndex: y - 1 });
      } else {
        ops.push({ type: "delete", aIndex: x - 1 });
      }
    }
    x = prevX;
    y = prevY;
  }

  ops.reverse();
  return ops;
}
