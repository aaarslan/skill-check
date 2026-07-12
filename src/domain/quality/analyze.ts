import { toAnalyzableDocument } from "../shared/markdown.ts";
import { allQualityRules } from "./rules/index.ts";
import { computeCategoryScores, computeOverallScore } from "./scoring.ts";
import type { QualityReport } from "./types.ts";

/**
 * Runs every deterministic quality rule against the given markdown content
 * and aggregates the result into category and overall scores. Pure: the
 * same content always produces the same report.
 */
export function analyzeQuality(content: string): QualityReport {
  const doc = toAnalyzableDocument(content);
  const findings = allQualityRules.flatMap((rule) => rule.evaluate(doc));
  const categoryScores = computeCategoryScores(findings);
  const score = computeOverallScore(categoryScores);
  return { score, categoryScores, findings };
}
