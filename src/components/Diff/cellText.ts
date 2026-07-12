import type { DiffLine } from "../../domain/diff/index.ts";

/**
 * Text to render inside a diff cell. A present-but-empty line collapses to a single
 * space so the row keeps its height; an absent cell (one side of a side-by-side gap)
 * renders nothing. Shared so the unified and side-by-side views stay in lockstep.
 */
export function cellText(line: DiffLine | null): string {
  if (!line) {
    return "";
  }
  return line.text.length > 0 ? line.text : " ";
}
