import type { AnalyzableDocument } from "../shared/markdown.ts";
import { stripInlineCode } from "../shared/markdown.ts";
import { downgradeSuspicionTier } from "./suspicion.ts";
import type { Suspicion } from "./types.ts";

// Cues that the surrounding text is describing/exampling the phrase rather than issuing
// it live: either an explicit example marker, or a negated frame ("do not do X", "an
// attack like X") where the document is warning against the pattern, not performing it.
const QUOTING_CUE =
  /\b(?:example|e\.g\.|for instance|such as|sample|illustrat\w*|for example|quoted|do not|don't|never|avoid|anti-pattern|counterexample|counter-example|reject|refuse|attempts? like|an attack like)\b/iu;
const QUOTED_TEXT = /["“][^"”]{3,}["”]/u;

/**
 * Heuristically decides whether a matched span reads as a quoted example
 * (code block, blockquote, inline code, or near "example"-style cues)
 * rather than an active imperative instruction.
 */
export function isLikelyQuotedContext(
  doc: AnalyzableDocument,
  lineNumber: number,
  codeLines: ReadonlySet<number>,
  matchedText: string,
): boolean {
  if (codeLines.has(lineNumber)) {
    return true;
  }
  const line = doc.lines[lineNumber - 1] ?? "";
  if (/^\s*>/u.test(line)) {
    return true;
  }
  const withoutInlineCode = stripInlineCode(line);
  if (
    matchedText.length > 0 &&
    line.includes(matchedText) &&
    !withoutInlineCode.includes(matchedText)
  ) {
    return true;
  }
  if (QUOTED_TEXT.test(line)) {
    return true;
  }
  const contextWindow = doc.lines.slice(Math.max(0, lineNumber - 4), lineNumber - 1).join(" ");
  return QUOTING_CUE.test(contextWindow);
}

/** Drops suspicion by one tier when the match is a quoted example rather than a live instruction. */
export function downgradeIfQuoted(base: Suspicion, quoted: boolean): Suspicion {
  return quoted ? downgradeSuspicionTier(base) : base;
}
