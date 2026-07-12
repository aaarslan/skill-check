import type { AnalyzableDocument } from "../../shared/markdown.ts";
import { codeBlockLineSet } from "../../shared/markdown.ts";
import { downgradeIfQuoted, isLikelyQuotedContext } from "../quotedContext.ts";
import type { InjectionFinding, InjectionRule, Suspicion } from "../types.ts";

const RULE_ID = "injection/hidden-content";

const HTML_COMMENT = /<!--([\s\S]*?)-->/gu;
const DIRECTIVE_CUE =
  /\b(?:ignore|instruction|system|execute|secret|password|override|reveal|bypass)\w*\b/iu;
const CSS_HIDING = /\b(?:display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0)\b/giu;
// URL group tolerates one level of nested parens, e.g. javascript:alert(1), instead of
// stopping at the first ")" and truncating the match.
const LINK_PATTERN = /\[([^\]]*)\]\(((?:[^()]|\([^()]*\))*)\)/gu;

const IP_LITERAL_HOST = /^https?:\/\/\d{1,3}(?:\.\d{1,3}){3}/iu;
const NON_HTTP_SCHEME = /^(?:data|javascript|vbscript):/iu;
const CREDENTIALS_IN_URL = /^https?:\/\/[^/\s]+:[^/\s]+@/iu;
const PUNYCODE_HOST = /^https?:\/\/(?:[^/]*\.)?xn--/iu;

function lineNumberForOffset(content: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === "\n") {
      line++;
    }
  }
  return line;
}

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

    for (const match of doc.content.matchAll(HTML_COMMENT)) {
      const commentBody = match[1] ?? "";
      const lineNumber = lineNumberForOffset(doc.content, match.index ?? 0);
      const hasDirective = DIRECTIVE_CUE.test(commentBody);
      const suspicion: Suspicion = hasDirective ? "high" : "low";
      const quoted = isLikelyQuotedContext(doc, lineNumber, codeLines, match[0]);
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

      for (const match of line.matchAll(LINK_PATTERN)) {
        const url = (match[2] ?? "").trim();
        const reason = suspiciousUrlReason(url);
        if (!reason) {
          continue;
        }
        const quoted = isLikelyQuotedContext(doc, lineNumber, codeLines, match[0]);
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
