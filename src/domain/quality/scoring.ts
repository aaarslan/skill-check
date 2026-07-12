import type { Severity } from "../shared/types.ts";
import type { CategoryScore, QualityCategory, QualityFinding } from "./types.ts";

const SEVERITY_DEDUCTION: Record<Severity, number> = {
  info: 2,
  low: 6,
  medium: 14,
  high: 28,
};

export const QUALITY_CATEGORIES: readonly QualityCategory[] = [
  "purpose",
  "actionability",
  "consistency",
  "structure",
  "integrity",
];

/** Starts each category at 100 and deducts per finding, floored at 0. */
export function computeCategoryScores(findings: readonly QualityFinding[]): CategoryScore[] {
  return QUALITY_CATEGORIES.map((category) => {
    const deduction = findings
      .filter((finding) => finding.category === category)
      .reduce((total, finding) => total + SEVERITY_DEDUCTION[finding.severity], 0);
    return { category, score: clamp(100 - deduction) };
  });
}

/** Overall score is the mean of category scores, so it stays legible against the breakdown. */
export function computeOverallScore(categoryScores: readonly CategoryScore[]): number {
  if (categoryScores.length === 0) {
    return 0;
  }
  const total = categoryScores.reduce((sum, entry) => sum + entry.score, 0);
  return Math.round(total / categoryScores.length);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}
