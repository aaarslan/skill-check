import { describe, expect, it } from "vite-plus/test";
import { analyzeQuality } from "./analyze.ts";
import { compareQualityReports } from "./compare.ts";
import { computeCategoryScores, computeOverallScore } from "./scoring.ts";
import type { QualityFinding } from "./types.ts";

describe("compareQualityReports", () => {
  it("reports an improvement when the candidate fixes a rule the original violated", () => {
    const original = analyzeQuality("Just some text without any real header.\n");
    const candidate = analyzeQuality(
      "---\nname: Fixed Skill\ndescription: Now has a clear purpose statement\n---\n\nBody text.\n",
    );
    const comparison = compareQualityReports(original, candidate);
    const purposeComparison = comparison.ruleComparisons.find(
      (entry) => entry.ruleId === "purpose/has-purpose-statement",
    );
    expect(purposeComparison?.verdict).toBe("improved");
    expect(comparison.scoreDelta).toBeGreaterThan(0);
  });

  it("reports a regression when the candidate introduces a new violation", () => {
    const original = analyzeQuality("Handle the request using the defined process.\n");
    const candidate = analyzeQuality("Handle the request properly.\n");
    const comparison = compareQualityReports(original, candidate);
    const ambiguousComparison = comparison.ruleComparisons.find(
      (entry) => entry.ruleId === "structure/ambiguous-terms",
    );
    expect(ambiguousComparison?.verdict).toBe("regressed");
  });

  it("reports no rule comparisons when both reports are identical", () => {
    const report = analyzeQuality("# Title\n\nSome content.\n");
    const comparison = compareQualityReports(report, report);
    expect(comparison.ruleComparisons).toHaveLength(0);
    expect(comparison.scoreDelta).toBe(0);
  });

  it("compares reports containing a rule id outside the standard per-file rule set without throwing", () => {
    const original = analyzeQuality("# Title\n\nSome content.\n");
    const crossFileFinding: QualityFinding = {
      ruleId: "integrity/cross-file-broken-link",
      category: "integrity",
      severity: "medium",
      message: "test",
      explanation: "test",
      suggestion: "test",
      location: null,
    };
    const candidateFindings = [...original.findings, crossFileFinding];
    const candidateCategoryScores = computeCategoryScores(candidateFindings);
    const candidate = {
      score: computeOverallScore(candidateCategoryScores),
      categoryScores: candidateCategoryScores,
      findings: candidateFindings,
    };

    expect(() => compareQualityReports(original, candidate)).not.toThrow();
    const comparison = compareQualityReports(original, candidate);
    const entry = comparison.ruleComparisons.find(
      (candidateEntry) => candidateEntry.ruleId === "integrity/cross-file-broken-link",
    );
    expect(entry?.verdict).toBe("regressed");
  });
});
