import type { AnalyzableDocument } from "../shared/markdown.ts";
import { codeBlockLineSet } from "../shared/markdown.ts";
import { downgradeIfDescriptive, isDescriptiveFraming } from "./mood.ts";
import { normalizeForMatching } from "./normalize.ts";
import { downgradeIfQuoted, isLikelyQuotedContext } from "./quotedContext.ts";
import { upgradeSuspicionTier } from "./suspicion.ts";
import type { InjectionCategory, InjectionFinding, Suspicion } from "./types.ts";

export interface PatternSpec {
  readonly pattern: RegExp;
  readonly rationale: string;
  readonly suspicion?: Suspicion;
}

function toGlobal(pattern: RegExp): RegExp {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return new RegExp(pattern.source, flags);
}

/**
 * Runs a list of regex pattern specs line by line against a document,
 * downgrading suspicion for matches that read as quoted examples or
 * descriptive (non-imperative) framing, and separately testing a
 * confusable/obfuscation-normalized variant of each line so lookalike-
 * character or separator-split evasion still surfaces (at a bumped
 * suspicion, since obfuscation is itself a signal). Shared by every
 * injection rule that reduces to "does this phrase appear".
 */
export function scanPatterns(
  doc: AnalyzableDocument,
  ruleId: string,
  category: InjectionCategory,
  defaultSuspicion: Suspicion,
  patterns: readonly PatternSpec[],
): InjectionFinding[] {
  const codeLines = codeBlockLineSet(doc);
  const findings: InjectionFinding[] = [];

  doc.lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const normalizedLine = normalizeForMatching(line);
    const lineWasNormalized = normalizedLine !== line;

    for (const spec of patterns) {
      const globalPattern = toGlobal(spec.pattern);
      const baseSuspicion = spec.suspicion ?? defaultSuspicion;
      let matchedRaw = false;

      for (const match of line.matchAll(globalPattern)) {
        matchedRaw = true;
        const matchedText = match[0];
        const quoted = isLikelyQuotedContext(doc, lineNumber, codeLines, matchedText);
        const descriptive = isDescriptiveFraming(line, match.index ?? 0);
        const suspicion = downgradeIfDescriptive(
          downgradeIfQuoted(baseSuspicion, quoted),
          descriptive,
        );
        findings.push({
          id: `${ruleId}:${lineNumber}:${match.index ?? 0}`,
          ruleId,
          category,
          suspicion,
          matchedText,
          location: { line: lineNumber, excerpt: matchedText },
          rationale: spec.rationale,
          isQuotedExample: quoted,
        });
      }

      // Only test the normalized variant when the raw line didn't already match —
      // a match that only appears after normalizing lookalike characters or
      // collapsing separators is itself evidence of deliberate obfuscation.
      if (matchedRaw || !lineWasNormalized) {
        continue;
      }
      const normalizedMatch = toGlobal(spec.pattern).exec(normalizedLine);
      if (!normalizedMatch) {
        continue;
      }
      findings.push({
        id: `${ruleId}:${lineNumber}:obfuscated:${normalizedMatch.index}`,
        ruleId,
        category,
        suspicion: upgradeSuspicionTier(baseSuspicion),
        matchedText: line.trim(),
        location: { line: lineNumber, excerpt: line.trim().slice(0, 100) },
        rationale: `${spec.rationale} (only matched after normalizing lookalike characters or separators — likely obfuscated)`,
        isQuotedExample: false,
      });
    }
  });

  return findings;
}

const CROSS_LINE_WINDOW_SIZES = [2, 3];

interface CrossLineCandidate {
  readonly start: number;
  readonly windowSize: number;
  readonly matchedText: string;
  readonly joined: string;
}

/**
 * Complements scanPatterns for phrases deliberately split across consecutive
 * lines to evade single-line matching. Only reports a window match when no
 * line inside the window already matches on its own (that's scanPatterns'
 * job), and is intentionally applied only to the highest-signal rules.
 */
export function scanCrossLinePatterns(
  doc: AnalyzableDocument,
  ruleId: string,
  category: InjectionCategory,
  defaultSuspicion: Suspicion,
  patterns: readonly PatternSpec[],
): InjectionFinding[] {
  const findings: InjectionFinding[] = [];

  for (const spec of patterns) {
    const candidates: CrossLineCandidate[] = [];

    for (const windowSize of CROSS_LINE_WINDOW_SIZES) {
      for (let start = 0; start + windowSize <= doc.lines.length; start++) {
        const windowLines = doc.lines.slice(start, start + windowSize);
        const nonEmptyCount = windowLines.filter((line) => line.trim().length > 0).length;
        if (nonEmptyCount < 2) {
          continue;
        }
        const singleLinePattern = new RegExp(
          spec.pattern.source,
          spec.pattern.flags.replace("g", ""),
        );
        if (windowLines.some((line) => singleLinePattern.test(line))) {
          continue;
        }
        const joined = windowLines.join(" ").replace(/\s+/gu, " ").trim();
        const match = toGlobal(spec.pattern).exec(joined);
        if (!match) {
          continue;
        }
        candidates.push({ start, windowSize, matchedText: match[0], joined });
      }
    }

    // Window sizes are checked smallest-first, so a larger window that fully contains
    // an already-kept smaller match is redundant noise (a 3-line join necessarily
    // re-matches whatever a 2-line join inside it already caught) — keep only the
    // minimal window per match.
    const kept: CrossLineCandidate[] = [];
    for (const candidate of candidates) {
      const isSupersetOfKept = kept.some(
        (existing) =>
          candidate.start <= existing.start &&
          candidate.start + candidate.windowSize >= existing.start + existing.windowSize,
      );
      if (!isSupersetOfKept) {
        kept.push(candidate);
      }
    }

    for (const candidate of kept) {
      const lineNumber = candidate.start + 1;
      findings.push({
        id: `${ruleId}:${lineNumber}:cross-line-${candidate.windowSize}`,
        ruleId,
        category,
        suspicion: spec.suspicion ?? defaultSuspicion,
        matchedText: candidate.matchedText,
        location: { line: lineNumber, excerpt: candidate.joined.slice(0, 100) },
        rationale: `${spec.rationale} (only matched when lines ${lineNumber}-${candidate.start + candidate.windowSize} are joined — possibly split across lines to evade detection)`,
        isQuotedExample: false,
      });
    }
  }

  return findings;
}
