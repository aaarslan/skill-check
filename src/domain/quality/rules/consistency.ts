import type { AnalyzableDocument } from "../../shared/markdown.ts";
import { codeBlockLineSet, stripInlineCode } from "../../shared/markdown.ts";
import type { QualityFinding, QualityRule } from "../types.ts";

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "and",
  "or",
  "is",
  "are",
  "be",
  "this",
  "that",
  "it",
  "your",
  "you",
  "when",
  "if",
  "any",
  "all",
  "not",
]);

function keywordsOf(phrase: string): Set<string> {
  return new Set(
    phrase
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word))
      .slice(0, 8),
  );
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) {
      intersection++;
    }
  }
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

interface ImperativeClause {
  readonly line: number;
  readonly excerpt: string;
  readonly keywords: ReadonlySet<string>;
}

const AFFIRMATIVE_PATTERN = /\b(?:always|must)\s+([a-z][a-z0-9 ,'-]{2,60})/giu;
const NEGATIVE_PATTERN =
  /\b(?:never|must not|do not|don't|should not|shouldn't)\s+([a-z][a-z0-9 ,'-]{2,60})/giu;

const conflictingImperatives: QualityRule = {
  id: "consistency/conflicting-imperatives",
  category: "consistency",
  description: "Flags affirmative and negated imperatives that target the same underlying action.",
  evaluate(doc: AnalyzableDocument): QualityFinding[] {
    const codeLines = codeBlockLineSet(doc);
    const affirmatives: ImperativeClause[] = [];
    const negatives: ImperativeClause[] = [];

    doc.lines.forEach((line, index) => {
      const lineNumber = index + 1;
      if (codeLines.has(lineNumber)) {
        return;
      }
      const stripped = stripInlineCode(line);
      for (const match of stripped.matchAll(NEGATIVE_PATTERN)) {
        negatives.push({
          line: lineNumber,
          excerpt: match[0].trim(),
          keywords: keywordsOf(match[1] ?? ""),
        });
      }
      for (const match of stripped.matchAll(AFFIRMATIVE_PATTERN)) {
        affirmatives.push({
          line: lineNumber,
          excerpt: match[0].trim(),
          keywords: keywordsOf(match[1] ?? ""),
        });
      }
    });

    const findings: QualityFinding[] = [];
    const reportedPairs = new Set<string>();
    for (const pos of affirmatives) {
      for (const neg of negatives) {
        if (pos.line === neg.line) {
          continue;
        }
        const pairKey = `${pos.line}:${neg.line}`;
        if (reportedPairs.has(pairKey) || jaccard(pos.keywords, neg.keywords) < 0.5) {
          continue;
        }
        reportedPairs.add(pairKey);
        findings.push({
          ruleId: conflictingImperatives.id,
          category: "consistency",
          severity: "high",
          message: "Conflicting imperative statements",
          explanation: `Line ${pos.line} says "${pos.excerpt}" while line ${neg.line} says "${neg.excerpt}", which read as direct contradictions about the same action.`,
          suggestion: "Reconcile the two statements so only one directive governs this action.",
          location: { line: pos.line, excerpt: pos.excerpt },
        });
      }
    }
    return findings;
  },
};

const excessiveRepetition: QualityRule = {
  id: "consistency/excessive-repetition",
  category: "consistency",
  description: "Flags lines repeated verbatim (ignoring case and whitespace) three or more times.",
  evaluate(doc: AnalyzableDocument): QualityFinding[] {
    const codeLines = codeBlockLineSet(doc);
    const occurrences = new Map<string, number[]>();

    doc.lines.forEach((line, index) => {
      const lineNumber = index + 1;
      if (codeLines.has(lineNumber)) {
        return;
      }
      const normalized = line.trim().toLowerCase().replace(/\s+/gu, " ");
      if (normalized.length < 12) {
        return;
      }
      const list = occurrences.get(normalized) ?? [];
      list.push(lineNumber);
      occurrences.set(normalized, list);
    });

    const findings: QualityFinding[] = [];
    for (const [normalized, lineNumbers] of occurrences) {
      if (lineNumbers.length < 3) {
        continue;
      }
      const first = lineNumbers[0] ?? 1;
      findings.push({
        ruleId: excessiveRepetition.id,
        category: "consistency",
        severity: lineNumbers.length >= 5 ? "high" : "medium",
        message: `Line repeated ${lineNumbers.length} times`,
        explanation: `The same line appears ${lineNumbers.length} times, at lines ${lineNumbers.join(", ")}.`,
        suggestion:
          "Remove or consolidate the repeated content; repetition dilutes signal and wastes context.",
        location: { line: first, excerpt: normalized.slice(0, 80) },
      });
    }
    return findings;
  },
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};
const COUNT_CLAIM =
  /\b(?:the following|these|following)\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(steps|rules|items|points|principles|categories|phases|stages)\b/iu;
const LIST_ITEM_PATTERN = /^\s*(?:[-*+]|\d+[.)])\s+/u;

const internalInconsistency: QualityRule = {
  id: "consistency/internal-inconsistency",
  category: "consistency",
  description: "Flags a stated item count that doesn't match the list that follows it.",
  evaluate(doc: AnalyzableDocument): QualityFinding[] {
    const codeLines = codeBlockLineSet(doc);
    const findings: QualityFinding[] = [];

    doc.lines.forEach((line, index) => {
      const lineNumber = index + 1;
      if (codeLines.has(lineNumber)) {
        return;
      }
      const match = COUNT_CLAIM.exec(stripInlineCode(line));
      if (!match) {
        return;
      }
      const rawNumber = match[1] ?? "";
      const noun = match[2] ?? "items";
      const claimed = NUMBER_WORDS[rawNumber.toLowerCase()] ?? Number.parseInt(rawNumber, 10);
      if (!Number.isFinite(claimed)) {
        return;
      }

      let i = index + 1;
      while (i < doc.lines.length && (doc.lines[i] ?? "").trim() === "") {
        i++;
      }
      let count = 0;
      while (i < doc.lines.length) {
        const candidate = doc.lines[i] ?? "";
        if (LIST_ITEM_PATTERN.test(candidate)) {
          count++;
          i++;
        } else if (candidate.trim() === "" && (doc.lines[i + 1] ?? "").trim() !== "") {
          i++;
        } else {
          break;
        }
      }

      if (count > 0 && count !== claimed) {
        findings.push({
          ruleId: internalInconsistency.id,
          category: "consistency",
          severity: "medium",
          message: `States "${rawNumber} ${noun}" but the list has ${count} item(s)`,
          explanation: `Line ${lineNumber} claims "${rawNumber} ${noun}", but the following list contains ${count} item(s).`,
          suggestion: "Update the stated count or the list so they agree.",
          location: { line: lineNumber, excerpt: match[0] },
        });
      }
    });

    return findings;
  },
};

export const consistencyRules: readonly QualityRule[] = [
  conflictingImperatives,
  excessiveRepetition,
  internalInconsistency,
];
