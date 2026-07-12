import { describe, expect, it } from "vite-plus/test";
import type { QualityFinding } from "./types.ts";
import { computeCategoryScores, computeOverallScore, QUALITY_CATEGORIES } from "./scoring.ts";

function finding(overrides: Partial<QualityFinding>): QualityFinding {
  return {
    ruleId: "test/rule",
    category: "purpose",
    severity: "medium",
    message: "test",
    explanation: "test",
    suggestion: "test",
    location: null,
    ...overrides,
  };
}

describe("computeCategoryScores", () => {
  it("scores every category at 100 when there are no findings", () => {
    const scores = computeCategoryScores([]);
    expect(scores).toHaveLength(QUALITY_CATEGORIES.length);
    expect(scores.every((entry) => entry.score === 100)).toBe(true);
  });

  it("deducts points proportional to severity", () => {
    const scores = computeCategoryScores([finding({ category: "structure", severity: "high" })]);
    const structureScore = scores.find((entry) => entry.category === "structure")?.score;
    expect(structureScore).toBe(72);
  });

  it("clamps a category score at zero rather than going negative", () => {
    const findings = Array.from({ length: 10 }, () =>
      finding({ category: "integrity", severity: "high" }),
    );
    const scores = computeCategoryScores(findings);
    const integrityScore = scores.find((entry) => entry.category === "integrity")?.score;
    expect(integrityScore).toBe(0);
  });
});

describe("computeOverallScore", () => {
  it("is the mean of category scores", () => {
    const overall = computeOverallScore([
      { category: "purpose", score: 100 },
      { category: "actionability", score: 50 },
    ]);
    expect(overall).toBe(75);
  });
});
