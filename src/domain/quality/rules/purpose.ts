import type { AnalyzableDocument } from "../../shared/markdown.ts";
import {
  codeBlockLineSet,
  parseHeadings,
  parseParagraphs,
  stripInlineCode,
} from "../../shared/markdown.ts";
import type { QualityFinding, QualityRule } from "../types.ts";

const FRONTMATTER_PATTERN = /^---\s*$/u;
const TRIGGER_PATTERNS: RegExp[] = [
  /\buse (?:this|the)?\s*(?:skill|tool) when\b/iu,
  /\btrigger(?:s)? (?:on|when)\b/iu,
  /\bwhen to use\b/iu,
  /\binvoke (?:this )?when\b/iu,
  /\bcall this (?:skill|tool) when\b/iu,
  /\bload(?:ing)? guidance\b/iu,
  /\bactivat(?:e|es|ion) when\b/iu,
];

function findFrontmatter(
  doc: AnalyzableDocument,
): { name: string | null; description: string | null } | null {
  if (!doc.lines[0] || !FRONTMATTER_PATTERN.test(doc.lines[0])) {
    return null;
  }
  let name: string | null = null;
  let description: string | null = null;
  for (let i = 1; i < doc.lines.length; i++) {
    const line = doc.lines[i];
    if (line === undefined) {
      break;
    }
    if (FRONTMATTER_PATTERN.test(line)) {
      return { name, description };
    }
    const nameMatch = /^name:\s*(.+)$/iu.exec(line);
    const descMatch = /^description:\s*(.+)$/iu.exec(line);
    if (nameMatch) {
      name = (nameMatch[1] ?? "").trim() || null;
    }
    if (descMatch) {
      description = (descMatch[1] ?? "").trim() || null;
    }
  }
  return null;
}

const hasPurposeStatement: QualityRule = {
  id: "purpose/has-purpose-statement",
  category: "purpose",
  description:
    "Checks for a clear name, description, scope, or purpose near the top of the document.",
  evaluate(doc: AnalyzableDocument): QualityFinding[] {
    const frontmatter = findFrontmatter(doc);
    if (frontmatter && frontmatter.name && frontmatter.description) {
      return [];
    }

    const headings = parseHeadings(doc);
    const firstHeading = headings[0];
    if (firstHeading && firstHeading.line <= 15) {
      const paragraphs = parseParagraphs(doc);
      const introParagraph = paragraphs.find(
        (p) => p.startLine > firstHeading.line && p.startLine <= firstHeading.line + 5,
      );
      if (introParagraph && introParagraph.text.split(/\s+/u).length >= 6) {
        return [];
      }
    }

    return [
      {
        ruleId: hasPurposeStatement.id,
        category: "purpose",
        severity: "high",
        message: "No clear name, description, scope, or purpose statement found",
        explanation:
          "Neither a frontmatter name/description pair nor a heading followed by an introductory paragraph was found near the top of the document. Readers (and loaders) need this to know what the skill is for before reading further.",
        suggestion:
          "Add a frontmatter `name:`/`description:` pair, or open with a heading followed by a short paragraph stating the skill's purpose and scope.",
        location: { line: 1, excerpt: (doc.lines[0] ?? "").slice(0, 80) },
      },
    ];
  },
};

const hasTriggerGuidance: QualityRule = {
  id: "purpose/has-trigger-guidance",
  category: "purpose",
  description: "Checks for guidance on when the skill should be triggered or loaded.",
  evaluate(doc: AnalyzableDocument): QualityFinding[] {
    const codeLines = codeBlockLineSet(doc);
    const prose = doc.lines
      .filter((_line, index) => !codeLines.has(index + 1))
      .map(stripInlineCode)
      .join("\n");
    const matched = TRIGGER_PATTERNS.some((pattern) => pattern.test(prose));
    if (matched) {
      return [];
    }
    return [
      {
        ruleId: hasTriggerGuidance.id,
        category: "purpose",
        severity: "medium",
        message: "No trigger or loading guidance found",
        explanation:
          'The document does not appear to state when it should be used or loaded (e.g. "use this skill when...", "trigger on..."). Without this, a caller cannot reliably decide when to invoke it.',
        suggestion:
          'Add an explicit line describing when this skill should be triggered, e.g. "Use when the user asks to ...".',
        location: null,
      },
    ];
  },
};

export const purposeRules: readonly QualityRule[] = [hasPurposeStatement, hasTriggerGuidance];
