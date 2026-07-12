import type { AnalyzableDocument } from "../../shared/markdown.ts";
import {
  codeBlockLineSet,
  parseHeadings,
  parseParagraphs,
  stripInlineCode,
} from "../../shared/markdown.ts";
import type { QualityFinding, QualityRule } from "../types.ts";

const LONG_PARAGRAPH_WORDS = 150;
const LONG_SECTION_WORDS = 400;

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/u).length;
}

const longSection: QualityRule = {
  id: "structure/long-section",
  category: "structure",
  description: "Flags paragraphs or sections that are unusually long.",
  evaluate(doc: AnalyzableDocument): QualityFinding[] {
    const findings: QualityFinding[] = [];

    for (const paragraph of parseParagraphs(doc)) {
      const words = wordCount(paragraph.text);
      if (words > LONG_PARAGRAPH_WORDS) {
        findings.push({
          ruleId: longSection.id,
          category: "structure",
          severity: words > 250 ? "high" : "medium",
          message: `Paragraph is ${words} words long`,
          explanation: `A single paragraph starting at line ${paragraph.startLine} runs ${words} words. Long unbroken paragraphs are harder to scan and to act on.`,
          suggestion: "Break this paragraph into shorter paragraphs, a list, or subheadings.",
          location: { line: paragraph.startLine, excerpt: paragraph.text.slice(0, 80) },
        });
      }
    }

    const headings = parseHeadings(doc);
    headings.forEach((heading, index) => {
      const next = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level);
      const endLine = next ? next.line - 1 : doc.lines.length;
      const sectionWords = wordCount(doc.lines.slice(heading.line, endLine).join(" "));
      if (sectionWords > LONG_SECTION_WORDS) {
        findings.push({
          ruleId: longSection.id,
          category: "structure",
          severity: sectionWords > 700 ? "high" : "medium",
          message: `Section "${heading.text}" is approximately ${sectionWords} words long`,
          explanation: `The section starting at line ${heading.line} runs roughly ${sectionWords} words before the next heading of the same or higher level.`,
          suggestion: "Split this section into smaller, focused subsections.",
          location: { line: heading.line, excerpt: heading.text },
        });
      }
    });

    return findings;
  },
};

const AMBIGUOUS_TERMS: RegExp[] = [
  /\bproperly\b/iu,
  /\bappropriately\b/iu,
  /\bas needed\b/iu,
  /\bcorrectly\b/iu,
  /\badequately\b/iu,
  /\breasonably\b/iu,
  /\bsufficiently\b/iu,
  /\bas appropriate\b/iu,
  /\bas necessary\b/iu,
  /\bin a timely manner\b/iu,
  /\bbest effort\b/iu,
];
const CRITERIA_QUALIFIER =
  /\b(?:as defined|according to|based on|per the|see (?:the )?section|as specified|defined (?:above|below)|as described)\b/iu;
const MAX_AMBIGUOUS_FINDINGS = 8;

const ambiguousTerms: QualityRule = {
  id: "structure/ambiguous-terms",
  category: "structure",
  description: 'Flags terms like "properly" or "as needed" used without accompanying criteria.',
  evaluate(doc: AnalyzableDocument): QualityFinding[] {
    const codeLines = codeBlockLineSet(doc);
    const matches: { line: number; excerpt: string }[] = [];

    doc.lines.forEach((line, index) => {
      const lineNumber = index + 1;
      if (codeLines.has(lineNumber)) {
        return;
      }
      const stripped = stripInlineCode(line);
      if (CRITERIA_QUALIFIER.test(stripped)) {
        return;
      }
      for (const pattern of AMBIGUOUS_TERMS) {
        const match = pattern.exec(stripped);
        if (match) {
          matches.push({ line: lineNumber, excerpt: match[0] });
        }
      }
    });

    const severity = matches.length >= 8 ? "high" : matches.length >= 4 ? "medium" : "low";
    return matches.slice(0, MAX_AMBIGUOUS_FINDINGS).map((match) => ({
      ruleId: ambiguousTerms.id,
      category: "structure",
      severity,
      message: `Ambiguous term "${match.excerpt}" used without stated criteria`,
      explanation: `"${match.excerpt}" at line ${match.line} does not specify what counts as meeting it, and no nearby qualifier (e.g. "as defined", "according to") was found.`,
      suggestion:
        "Replace the ambiguous term with a concrete, checkable criterion, or point to where one is defined.",
      location: match,
    }));
  },
};

const lowConcision: QualityRule = {
  id: "structure/low-concision",
  category: "structure",
  description:
    "Flags low information density: long prose with little structure, or very long sentences.",
  evaluate(doc: AnalyzableDocument): QualityFinding[] {
    const codeLines = codeBlockLineSet(doc);
    let proseWords = 0;
    let sentenceCount = 0;
    let listItemCount = 0;

    doc.lines.forEach((line, index) => {
      const lineNumber = index + 1;
      if (codeLines.has(lineNumber)) {
        return;
      }
      if (/^\s*(?:[-*+]|\d+[.)])\s+/u.test(line)) {
        listItemCount++;
      }
      const stripped = stripInlineCode(line);
      proseWords += wordCount(stripped);
      sentenceCount += (stripped.match(/[.!?]+(?:\s|$)/gu) ?? []).length;
    });

    const structuralMarkers = parseHeadings(doc).length + listItemCount;
    const avgSentenceLength = sentenceCount > 0 ? proseWords / sentenceCount : proseWords;
    const findings: QualityFinding[] = [];

    if (proseWords > 500 && structuralMarkers <= Math.max(1, Math.floor(proseWords / 400))) {
      findings.push({
        ruleId: lowConcision.id,
        category: "structure",
        severity: "medium",
        message: `Low structural density: ${proseWords} words of prose with only ${structuralMarkers} heading/list markers`,
        explanation:
          "Long stretches of prose with few headings or list items are harder to scan and increase the chance of missed instructions.",
        suggestion: "Break the content up with headings, bullet points, or numbered steps.",
        location: null,
      });
    }
    if (avgSentenceLength > 40) {
      findings.push({
        ruleId: lowConcision.id,
        category: "structure",
        severity: "low",
        message: `Average sentence length is approximately ${Math.round(avgSentenceLength)} words`,
        explanation: "Long average sentence length reduces readability and information density.",
        suggestion: "Shorten sentences; prefer one instruction per sentence.",
        location: null,
      });
    }

    return findings;
  },
};

export const structureRules: readonly QualityRule[] = [longSection, ambiguousTerms, lowConcision];
