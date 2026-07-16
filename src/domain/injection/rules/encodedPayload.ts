import type { AnalyzableDocument } from "../../shared/markdown.ts";
import { codeBlockLineSet } from "../../shared/markdown.ts";
import { downgradeIfQuoted, isLikelyQuotedContext } from "../quotedContext.ts";
import type { InjectionFinding, InjectionRule, Suspicion } from "../types.ts";

const RULE_ID = "injection/encoded-payload";

// Base64 runs use a lower length threshold on lines that also carry a decode
// directive ("decode this and run it") \u2014 real payloads paired with an explicit
// instruction tend to be shorter than the conservative default.
const BASE64_RUN_STRICT = /[A-Za-z0-9+/]{40,}={0,2}/gu;
const BASE64_RUN_LOOSE = /[A-Za-z0-9+/]{24,}={0,2}/gu;
const HEX_ESCAPE_RUN = /(?:\\x[0-9a-fA-F]{2}){6,}/gu;
const PERCENT_ENCODING_RUN = /(?:%[0-9a-fA-F]{2}){6,}/gu;
const UNICODE_ESCAPE_RUN = /(?:\\u[0-9a-fA-F]{4}){4,}/gu;
const HTML_ENTITY_RUN = /(?:&#x?[0-9a-fA-F]+;){6,}/giu;
// Zero-width space/joiners, directional marks and overrides, word joiner, and BOM/zero-width no-break space.
const ZERO_WIDTH_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/gu;
// Unicode tag-character block (U+E0000-U+E007F), a known technique for smuggling hidden ASCII payloads.
const UNICODE_TAG_CHARS = /[\u{E0000}-\u{E007F}]/gu;
const DECODE_DIRECTIVE = /\b(?:decode|execute|run|eval)\b/iu;

function pushMatches(
  doc: AnalyzableDocument,
  codeLines: ReadonlySet<number>,
  line: string,
  lineNumber: number,
  pattern: RegExp,
  rationale: string,
  suspicionFor: (matchedText: string, line: string) => Suspicion,
  findings: InjectionFinding[],
): void {
  for (const match of line.matchAll(pattern)) {
    const matchedText = match[0];
    const quoted = isLikelyQuotedContext(
      doc,
      lineNumber,
      codeLines,
      match.index ?? 0,
      matchedText.length,
    );
    findings.push({
      id: `${RULE_ID}:${lineNumber}:${match.index ?? 0}`,
      ruleId: RULE_ID,
      category: "encoded-payload",
      suspicion: downgradeIfQuoted(suspicionFor(matchedText, line), quoted),
      matchedText,
      location: {
        line: lineNumber,
        excerpt: matchedText.length > 60 ? `${matchedText.slice(0, 60)}...` : matchedText,
      },
      rationale,
      isQuotedExample: quoted,
    });
  }
}

export const encodedPayloadRule: InjectionRule = {
  id: RULE_ID,
  category: "encoded-payload",
  description:
    "Detects encoded or obfuscated payload indicators: base64/hex/percent runs, zero-width and Unicode tag characters.",
  evaluate(doc: AnalyzableDocument): InjectionFinding[] {
    const codeLines = codeBlockLineSet(doc);
    const findings: InjectionFinding[] = [];

    doc.lines.forEach((line, index) => {
      const lineNumber = index + 1;

      pushMatches(
        doc,
        codeLines,
        line,
        lineNumber,
        ZERO_WIDTH_CHARS,
        "Contains zero-width or bidirectional-control characters, which can hide invisible instructions.",
        () => "high",
        findings,
      );
      pushMatches(
        doc,
        codeLines,
        line,
        lineNumber,
        UNICODE_TAG_CHARS,
        "Contains Unicode tag characters (U+E0000 block), a known technique for smuggling hidden ASCII payloads.",
        () => "high",
        findings,
      );
      const hasDecodeDirective = DECODE_DIRECTIVE.test(line);
      pushMatches(
        doc,
        codeLines,
        line,
        lineNumber,
        hasDecodeDirective ? BASE64_RUN_LOOSE : BASE64_RUN_STRICT,
        "Long base64-like run; could be an encoded payload intended to be decoded and acted on.",
        () => (hasDecodeDirective ? "high" : "medium"),
        findings,
      );
      pushMatches(
        doc,
        codeLines,
        line,
        lineNumber,
        HEX_ESCAPE_RUN,
        "Long run of hex escape sequences; could be an encoded payload.",
        (_matched, l) => (DECODE_DIRECTIVE.test(l) ? "high" : "medium"),
        findings,
      );
      pushMatches(
        doc,
        codeLines,
        line,
        lineNumber,
        PERCENT_ENCODING_RUN,
        "Long run of percent-encoded bytes; could be an encoded payload.",
        (_matched, l) => (DECODE_DIRECTIVE.test(l) ? "high" : "medium"),
        findings,
      );
      pushMatches(
        doc,
        codeLines,
        line,
        lineNumber,
        UNICODE_ESCAPE_RUN,
        "Long run of \\u-escaped characters; could be an encoded payload.",
        (_matched, l) => (DECODE_DIRECTIVE.test(l) ? "high" : "medium"),
        findings,
      );
      pushMatches(
        doc,
        codeLines,
        line,
        lineNumber,
        HTML_ENTITY_RUN,
        "Long run of HTML character entities; could be an encoded payload.",
        (_matched, l) => (DECODE_DIRECTIVE.test(l) ? "high" : "medium"),
        findings,
      );
    });

    return findings;
  },
};
