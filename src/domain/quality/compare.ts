import { QUALITY_CATEGORIES } from "./scoring.ts";
import type { QualityCategory, QualityFinding, QualityReport } from "./types.ts";

export type ComparisonVerdict = "improved" | "regressed";

export interface RuleComparison {
  readonly ruleId: string;
  readonly category: QualityCategory;
  readonly originalCount: number;
  readonly candidateCount: number;
  readonly verdict: ComparisonVerdict;
}

export interface CategoryDelta {
  readonly category: QualityCategory;
  readonly original: number;
  readonly candidate: number;
  readonly delta: number;
}

export interface QualityComparison {
  readonly scoreDelta: number;
  readonly categoryDeltas: readonly CategoryDelta[];
  readonly ruleComparisons: readonly RuleComparison[];
}

function countByRule(findings: readonly QualityFinding[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const finding of findings) {
    counts.set(finding.ruleId, (counts.get(finding.ruleId) ?? 0) + 1);
  }
  return counts;
}

/** Derives ruleId -> category from the findings actually present, so this stays correct
 * for any finding source (a QualityRule or a comparison-scoped check like cross-file
 * link validation) without needing to know the full universe of rule ids in advance. */
function buildCategoryByRuleId(
  ...findingSets: readonly (readonly QualityFinding[])[]
): Map<string, QualityCategory> {
  const map = new Map<string, QualityCategory>();
  for (const findings of findingSets) {
    for (const finding of findings) {
      if (!map.has(finding.ruleId)) {
        map.set(finding.ruleId, finding.category);
      }
    }
  }
  return map;
}

/** Compares two quality reports, surfacing per-category score movement and per-rule improvement/regression. */
export function compareQualityReports(
  original: QualityReport,
  candidate: QualityReport,
): QualityComparison {
  const categoryDeltas: CategoryDelta[] = QUALITY_CATEGORIES.map((category) => {
    const originalScore =
      original.categoryScores.find((entry) => entry.category === category)?.score ?? 0;
    const candidateScore =
      candidate.categoryScores.find((entry) => entry.category === category)?.score ?? 0;
    return {
      category,
      original: originalScore,
      candidate: candidateScore,
      delta: candidateScore - originalScore,
    };
  });

  const categoryByRuleId = buildCategoryByRuleId(original.findings, candidate.findings);
  const originalCounts = countByRule(original.findings);
  const candidateCounts = countByRule(candidate.findings);
  const ruleIds = new Set([...originalCounts.keys(), ...candidateCounts.keys()]);

  const ruleComparisons: RuleComparison[] = [];
  for (const ruleId of ruleIds) {
    const originalCount = originalCounts.get(ruleId) ?? 0;
    const candidateCount = candidateCounts.get(ruleId) ?? 0;
    if (originalCount === candidateCount) {
      continue;
    }
    const category = categoryByRuleId.get(ruleId);
    if (!category) {
      throw new Error(`Unknown quality rule id encountered during comparison: ${ruleId}`);
    }
    ruleComparisons.push({
      ruleId,
      category,
      originalCount,
      candidateCount,
      verdict: candidateCount < originalCount ? "improved" : "regressed",
    });
  }

  return {
    scoreDelta: candidate.score - original.score,
    categoryDeltas,
    ruleComparisons,
  };
}
