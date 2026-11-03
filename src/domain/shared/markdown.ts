/** A document split into lines for line-anchored analysis, kept alongside its raw content. */
export interface AnalyzableDocument {
  readonly content: string;
  readonly lines: readonly string[];
}

export function toAnalyzableDocument(content: string): AnalyzableDocument {
  return { content, lines: content.split("\n") };
}

export interface Heading {
  readonly level: number;
  readonly text: string;
  /** 1-indexed line number. */
  readonly line: number;
  readonly slug: string;
}

const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/u;

/** Extracts ATX (`#`) headings, skipping any inside fenced code blocks. */
export function parseHeadings(doc: AnalyzableDocument): Heading[] {
  const codeLines = codeBlockLineSet(doc);
  const headings: Heading[] = [];
  // GitHub disambiguates repeated heading text by suffixing -1, -2, ... on
  // each subsequent occurrence of the same base slug.
  const slugOccurrences = new Map<string, number>();
  doc.lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (codeLines.has(lineNumber)) {
      return;
    }
    const match = HEADING_PATTERN.exec(line);
    if (!match) {
      const setextLevel =
        index > 0 && /^=+\s*$/u.test(line) ? 1 : index > 0 && /^-+\s*$/u.test(line) ? 2 : 0;
      if (setextLevel > 0) {
        const text = (doc.lines[index - 1] ?? "").trim();
        const inFrontmatter = (doc.lines[0] ?? "").trim() === "---";
        if (
          text &&
          !inFrontmatter &&
          !codeLines.has(index) &&
          !/^(?:[#>-]|\d+[.)])\s/u.test(text) &&
          !HEADING_PATTERN.test(doc.lines[index - 1] ?? "")
        ) {
          const baseSlug = slugifyHeading(text);
          const occurrence = slugOccurrences.get(baseSlug) ?? 0;
          slugOccurrences.set(baseSlug, occurrence + 1);
          const slug = occurrence === 0 ? baseSlug : `${baseSlug}-${occurrence}`;
          headings.push({ level: setextLevel, text, line: index, slug });
        }
      }
      return;
    }
    const hashes = match[1] ?? "";
    const text = (match[2] ?? "").trim().replace(/\s+#+$/u, "");
    const baseSlug = slugifyHeading(text);
    const occurrence = slugOccurrences.get(baseSlug) ?? 0;
    slugOccurrences.set(baseSlug, occurrence + 1);
    const slug = occurrence === 0 ? baseSlug : `${baseSlug}-${occurrence}`;
    headings.push({ level: hashes.length, text, line: lineNumber, slug });
  });
  return headings;
}

/** Approximates GitHub's heading-to-anchor slug algorithm. */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}_\s-]/gu, "")
    .replace(/\s+/gu, "-");
}

const FENCE_PATTERN = /^\s*(`{3,}|~{3,})([^`~]*)$/u;

/** Returns the set of 1-indexed line numbers that fall inside a fenced code block (fence lines included). */
export function codeBlockLineSet(doc: AnalyzableDocument): Set<number> {
  const lines = new Set<number>();
  let fenceMarker: string | null = null;
  let previousBlank = true;
  let previousIndentedCode = false;
  let listContentIndent: number | null = null;
  doc.lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const match = FENCE_PATTERN.exec(line);
    if (fenceMarker === null) {
      if (match) {
        fenceMarker = match[1] ?? null;
        lines.add(lineNumber);
        previousBlank = false;
        previousIndentedCode = false;
        return;
      }
      const indent = line.length - line.trimStart().length + (line.startsWith("\t") ? 3 : 0);
      const listMarker = /^(\s*(?:[-*+]|\d+[.)])\s+)\S/u.exec(line);
      if (listMarker) {
        listContentIndent = (listMarker[1] ?? "").length;
      } else if (line.trim() !== "" && listContentIndent !== null && indent < listContentIndent) {
        listContentIndent = null;
      }
      const codeThreshold = (listContentIndent ?? 0) + 4;
      const indentedCode =
        indent >= codeThreshold && line.trim() !== "" && (previousBlank || previousIndentedCode);
      if (indentedCode) lines.add(lineNumber);
      previousIndentedCode = indentedCode || (previousIndentedCode && line.trim() === "");
      previousBlank = line.trim() === "";
      return;
    }
    lines.add(lineNumber);
    const closesFence =
      match !== null &&
      (match[1] ?? "").startsWith(fenceMarker.charAt(0)) &&
      (match[1] ?? "").length >= fenceMarker.length &&
      (match[2] ?? "").trim() === "";
    if (closesFence) {
      fenceMarker = null;
      previousBlank = false;
      previousIndentedCode = false;
    }
  });
  return lines;
}

const INLINE_CODE_PATTERN = /`[^`]*`/gu;

/** Removes inline code spans from a line, for prose-only heuristics that should ignore code samples. */
export function stripInlineCode(line: string): string {
  return line.replace(INLINE_CODE_PATTERN, "");
}

/** Splits document content into non-empty paragraphs, each tagged with its starting line number. */
export interface Paragraph {
  readonly text: string;
  readonly startLine: number;
  readonly lineCount: number;
}

export function parseParagraphs(doc: AnalyzableDocument): Paragraph[] {
  const codeLines = codeBlockLineSet(doc);
  const paragraphs: Paragraph[] = [];
  let current: string[] = [];
  let startLine = 0;

  const flush = () => {
    if (current.length > 0) {
      paragraphs.push({ text: current.join(" "), startLine, lineCount: current.length });
      current = [];
    }
  };

  doc.lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const isStructural =
      codeLines.has(lineNumber) ||
      HEADING_PATTERN.test(line) ||
      /^\s*[-*+]\s+/u.test(line) ||
      /^\s*\d+[.)]\s+/u.test(line) ||
      /^\s*>/u.test(line) ||
      line.trim().length === 0;

    if (isStructural) {
      flush();
      return;
    }
    if (current.length === 0) {
      startLine = lineNumber;
    }
    current.push(line.trim());
  });
  flush();
  return paragraphs;
}
