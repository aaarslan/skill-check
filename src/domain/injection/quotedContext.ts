import type { AnalyzableDocument } from "../shared/markdown.ts";
import { stripInlineCode } from "../shared/markdown.ts";
import { downgradeSuspicionTier } from "./suspicion.ts";
import type { Suspicion } from "./types.ts";

// Cues that the surrounding text is describing/exampling the phrase rather than issuing
// it live: either an explicit example marker, or a negated frame ("do not do X", "an
// attack like X") where the document is warning against the pattern, not performing it.
const QUOTING_CUE =
  /\b(?:example|e\.g\.|for instance|such as|sample|illustrat\w*|for example|quoted|do not|don't|never|avoid|anti-pattern|counterexample|counter-example|reject|refuse|attempts? like|an attack like)\b/iu;
const INLINE_CODE = /`[^`]*`/gu;
const QUOTE_PAIRS = [
  ['"', '"'],
  ["“", "”"],
  ["‘", "’"],
] as const;

function spanIsInsideRange(
  spanStart: number,
  spanLength: number,
  rangeStart: number,
  rangeEnd: number,
): boolean {
  const spanEnd = spanStart + Math.max(spanLength, 1);
  return spanStart >= rangeStart && spanEnd <= rangeEnd;
}

function isInsideInlineCode(line: string, matchStart: number, matchLength: number): boolean {
  for (const match of line.matchAll(INLINE_CODE)) {
    const start = match.index ?? 0;
    if (spanIsInsideRange(matchStart, matchLength, start + 1, start + match[0].length - 1)) {
      return true;
    }
  }
  return false;
}

function isInsideQuotedText(line: string, matchStart: number, matchLength: number): boolean {
  for (const [open, close] of QUOTE_PAIRS) {
    let searchFrom = 0;
    while (searchFrom < line.length) {
      const openIndex = line.indexOf(open, searchFrom);
      if (openIndex < 0) {
        break;
      }
      const closeIndex = line.indexOf(close, openIndex + open.length);
      if (closeIndex < 0) {
        break;
      }
      if (spanIsInsideRange(matchStart, matchLength, openIndex + open.length, closeIndex)) {
        return true;
      }
      searchFrom = closeIndex + close.length;
    }
  }
  return false;
}

/**
 * Heuristically decides whether a matched span reads as a quoted example
 * (code block, blockquote, inline code, or near "example"-style cues)
 * rather than an active imperative instruction.
 */
export function isLikelyQuotedContext(
  doc: AnalyzableDocument,
  lineNumber: number,
  codeLines: ReadonlySet<number>,
  matchStart: number,
  matchLength: number,
): boolean {
  if (codeLines.has(lineNumber)) {
    return true;
  }
  const line = doc.lines[lineNumber - 1] ?? "";
  if (/^\s*>/u.test(line)) {
    return true;
  }
  if (isInsideInlineCode(line, matchStart, matchLength)) {
    return true;
  }
  if (isInsideQuotedText(line, matchStart, matchLength)) {
    return true;
  }
  const currentLinePrefix = stripInlineCode(line.slice(0, Math.max(0, matchStart)));
  const contextWindow = [
    ...doc.lines.slice(Math.max(0, lineNumber - 4), lineNumber - 1),
    currentLinePrefix,
  ].join(" ");
  return QUOTING_CUE.test(contextWindow);
}

/** Drops suspicion by one tier when the match is a quoted example rather than a live instruction. */
export function downgradeIfQuoted(base: Suspicion, quoted: boolean): Suspicion {
  return quoted ? downgradeSuspicionTier(base) : base;
}
