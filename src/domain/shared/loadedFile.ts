import type { LoadedFile } from "./types.ts";

/** Builds a {@link LoadedFile} from raw text, computing size and word/line counts. */
export function toLoadedFile(content: string, filename: string | null): LoadedFile {
  return {
    filename,
    content,
    sizeBytes: new TextEncoder().encode(content).length,
    wordCount: countWords(content),
    lineCount: content.length === 0 ? 0 : content.split("\n").length,
  };
}

function countWords(content: string): number {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  return trimmed.split(/\s+/u).length;
}
