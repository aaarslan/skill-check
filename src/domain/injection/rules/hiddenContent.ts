import type { AnalyzableDocument } from "../../shared/markdown.ts";
import { codeBlockLineSet } from "../../shared/markdown.ts";
import {
  downgradeIfQuoted,
  isLikelyQuotedContext,
  prepareQuotedChecker,
} from "../quotedContext.ts";
import type { InjectionFinding, InjectionRule, Suspicion } from "../types.ts";

const RULE_ID = "injection/hidden-content";

const HTML_COMMENT = /<!--([\s\S]*?)-->/gu;
const DIRECTIVE_CUE =
  /\b(?:ignore|instruction|system|execute|secret|password|override|reveal|bypass)\w*\b/iu;
const CSS_HIDING = /\b(?:display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0)\b/giu;
// URL group tolerates one level of nested parens, e.g. javascript:alert(1), instead of
// stopping at the first ")" and truncating the match.
const LINK_PATTERN = /\[([^\]]{0,500})\]\(((?:[^()]|\([^()]{0,1000}\)){0,1000})\)/gu;

const IP_LITERAL_HOST = /^https?:\/\/\d{1,3}(?:\.\d{1,3}){3}/iu;
const NON_HTTP_SCHEME = /^(?:data|javascript|vbscript):/iu;
const CREDENTIALS_IN_URL = /^https?:\/\/[^/\s]+:[^/\s]+@/iu;
const PUNYCODE_HOST = /^https?:\/\/(?:[^/]*\.)?xn--/iu;

function suspiciousUrlReason(url: string): string | null {
  if (NON_HTTP_SCHEME.test(url)) {
    return `uses a non-http "${url.split(":")[0]}:" scheme`;
  }
  if (CREDENTIALS_IN_URL.test(url)) {
    return "embeds credentials in the URL";
  }
  if (IP_LITERAL_HOST.test(url)) {
    return "points at a raw IP address instead of a domain";
  }
  if (PUNYCODE_HOST.test(url)) {
    return "uses a punycode (xn--) domain, often used to spoof lookalike hostnames";
  }
  return null;
}

export const hiddenContentRule: InjectionRule = {
  id: RULE_ID,
  category: "hidden-content",
  description:
    "Detects hidden Markdown/HTML content (comments, CSS-hidden text) and suspicious external links.",
  evaluate(doc: AnalyzableDocument): InjectionFinding[] {
    const codeLines = codeBlockLineSet(doc);
    const findings: InjectionFinding[] = [];

    let scannedOffset = 0;
    let scannedLine = 1;
    let scannedLineStart = 0;
    const checkersByLine = new Map<number, ReturnType<typeof prepareQuotedChecker>>();
    for (const match of doc.content.includes("-->") ? doc.content.matchAll(HTML_COMMENT) : []) {
      const commentBody = match[1] ?? "";
      const matchOffset = match.index ?? 0;
      for (let i = scannedOffset; i < matchOffset; i++) {
        if (doc.content[i] === "\n") {
          scannedLine++;
          scannedLineStart = i + 1;
        }
      }
      scannedOffset = matchOffset;
      const lineNumber = scannedLine;
      const hasDirective = DIRECTIVE_CUE.test(commentBody);
      const suspicion: Suspicion = hasDirective ? "high" : "low";
      let quotedAt = checkersByLine.get(lineNumber);
      if (!quotedAt) {
        quotedAt = prepareQuotedChecker(doc, lineNumber, codeLines);
        checkersByLine.set(lineNumber, quotedAt);
      }
      const quoted = quotedAt(matchOffset - scannedLineStart, match[0].length);
      findings.push({
        id: `${RULE_ID}:${lineNumber}:${match.index ?? 0}`,
        ruleId: RULE_ID,
        category: "hidden-content",
        suspicion: downgradeIfQuoted(suspicion, quoted),
        matchedText: match[0].length > 80 ? `${match[0].slice(0, 80)}...` : match[0],
        location: { line: lineNumber, excerpt: commentBody.trim().slice(0, 80) },
        rationale: hasDirective
          ? "HTML comment contains directive-like language and is invisible when the Markdown is rendered."
          : "HTML comment is invisible when the Markdown is rendered; its content should be reviewed.",
        isQuotedExample: quoted,
      });
    }

    const INVISIBLE =
      /[\u{E0000}-\u{E007F}\u202A-\u202E\u2066-\u2069]|(?:\u200B|\u200C|\u200D|\uFEFF){3,}/gu;
    doc.lines.forEach((line, index) => {
      const quotedAt = prepareQuotedChecker(doc, index + 1, codeLines);
      for (const match of line.matchAll(INVISIBLE)) {
        const quoted = quotedAt(match.index ?? 0, match[0].length);
        findings.push({
          id: `${RULE_ID}:${index + 1}:invisible:${match.index ?? 0}`,
          ruleId: RULE_ID,
          category: "hidden-content",
          suspicion: downgradeIfQuoted("high", quoted),
          matchedText: line.trim().slice(0, 80),
          location: { line: index + 1, excerpt: line.trim().slice(0, 80) },
          rationale:
            "Invisible Unicode (tag characters, bidirectional controls, or zero-width runs) can hide instructions from human review while remaining readable by a model.",
          isQuotedExample: quoted,
        });
        break;
      }
    });

    doc.lines.forEach((line, index) => {
      const lineNumber = index + 1;
      if (codeLines.has(lineNumber)) {
        return;
      }
      for (const match of line.matchAll(CSS_HIDING)) {
        findings.push({
          id: `${RULE_ID}:${lineNumber}:${match.index ?? 0}`,
          ruleId: RULE_ID,
          category: "hidden-content",
          suspicion: "medium",
          matchedText: match[0],
          location: { line: lineNumber, excerpt: match[0] },
          rationale:
            "CSS hides this content from rendered view while it remains readable by a model.",
          isQuotedExample: false,
        });
      }

      if (!line.includes("](")) return;
      for (const match of line.matchAll(LINK_PATTERN)) {
        const url = (match[2] ?? "").trim();
        const reason = suspiciousUrlReason(url);
        if (!reason) {
          continue;
        }
        const quoted = isLikelyQuotedContext(
          doc,
          lineNumber,
          codeLines,
          match.index ?? 0,
          match[0].length,
        );
        findings.push({
          id: `${RULE_ID}:${lineNumber}:${match.index ?? 0}`,
          ruleId: RULE_ID,
          category: "hidden-content",
          suspicion: downgradeIfQuoted("medium", quoted),
          matchedText: match[0],
          location: { line: lineNumber, excerpt: match[0] },
          rationale: `Link ${reason}.`,
          isQuotedExample: quoted,
        });
      }
    });

    return findings;
  },
};
