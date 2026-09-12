import { detectInjection } from "../injection/detect.ts";
import { INJECTION_CATEGORIES } from "../injection/taxonomy.ts";
import { RULE_VERSION } from "../review/analyze.ts";
import { CALIBRATION_FIXTURES, CORPUS_VERSION, type CalibrationFixture } from "./fixtures.ts";

export function evaluateCalibration(
  fixtures: readonly CalibrationFixture[] = CALIBRATION_FIXTURES,
) {
  const cases = fixtures.map((fixture) => {
    const findings = detectInjection(fixture.content);
    const predicted = [
      ...new Set(
        findings
          .filter((finding) => finding.suspicion !== "low")
          .map((finding) => finding.category),
      ),
    ];
    return {
      ...fixture,
      predicted,
      missed: fixture.expected.filter((category) => !predicted.includes(category)),
      falsePositives: predicted.filter((category) => !fixture.expected.includes(category)),
    };
  });
  const categories = INJECTION_CATEGORIES.map((category) => {
    const positives = cases.filter((item) => item.expected.includes(category));
    const negatives = cases.filter((item) => !item.expected.includes(category));
    const misses = positives.filter((item) => item.missed.includes(category)).length;
    const falsePositives = negatives.filter((item) =>
      item.falsePositives.includes(category),
    ).length;
    return {
      category,
      positives: positives.length,
      negatives: negatives.length,
      truePositives: positives.length - misses,
      falsePositives,
      misses,
      falsePositiveRate: negatives.length ? falsePositives / negatives.length : null,
      missRate: positives.length ? misses / positives.length : null,
    };
  });
  return {
    corpusVersion: CORPUS_VERSION,
    ruleVersion: RULE_VERSION,
    threshold: "medium-or-high",
    cases,
    categories,
    limitations:
      "Small author-labeled synthetic corpus used during development; not held out, representative, independently adjudicated, or evidence of real-world safety or agent effectiveness. Rates are per document/category. Low-suspicion matches do not count as positive predictions.",
  };
}
