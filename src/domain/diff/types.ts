export type DiffLineType = "unchanged" | "added" | "removed";

export interface DiffLine {
  readonly type: DiffLineType;
  readonly originalLineNumber: number | null;
  readonly candidateLineNumber: number | null;
  readonly text: string;
}

export interface DiffResult {
  readonly lines: readonly DiffLine[];
  readonly addedCount: number;
  readonly removedCount: number;
  readonly identical: boolean;
  /** Whole-file replacement fallback when a minimal diff would exceed the work budget. */
  readonly bounded?: boolean;
}

export interface DiffOptions {
  readonly ignoreWhitespace: boolean;
}

export interface SideBySideRow {
  readonly left: DiffLine | null;
  readonly right: DiffLine | null;
}

export interface ChangeGroup {
  readonly startIndex: number;
  readonly endIndex: number;
}
