import { detectInjection } from "../injection/detect.ts";
import { INJECTION_CATEGORIES } from "../injection/taxonomy.ts";
import { RULE_VERSION } from "../review/analyze.ts";
import { CALIBRATION_FIXTURES, CORPUS_VERSION, type CalibrationFixture } from "./fixtures.ts";
import { HELDOUT_FIXTURES } from "./heldout.ts";

export const ALL_CALIBRATION_FIXTURES: readonly CalibrationFixture[] = [
  ...CALIBRATION_FIXTURES,
  ...HELDOUT_FIXTURES,
];

export function evaluateCalibration(
  fixtures: readonly CalibrationFixture[] = ALL_CALIBRATION_FIXTURES,
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
  const summarize = (subset: typeof cases) =>
    INJECTION_CATEGORIES.map((category) => {
      const positives = subset.filter((item) => item.expected.includes(category));
      const negatives = subset.filter((item) => !item.expected.includes(category));
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
  const categories = summarize(cases);
  const bySplit = (split: "dev" | "heldout") =>
    summarize(cases.filter((item) => (item.split ?? "dev") === split));
  return {
    corpusVersion: CORPUS_VERSION,
    ruleVersion: RULE_VERSION,
    threshold: "medium-or-high",
    cases,
    categories,
    splits: {
      dev: bySplit("dev"),
      heldout: bySplit("heldout"),
    },
    splitCounts: {
      dev: cases.filter((item) => (item.split ?? "dev") === "dev").length,
      heldout: cases.filter((item) => item.split === "heldout").length,
    },
    limitations:
      "Author-labeled synthetic corpus with a dev split used while tuning rules and a held-out split not used to tune the 2026.11 additions. Still small, not independently adjudicated, not representative, and not evidence of real-world safety or agent effectiveness. Prefer held-out rates. Rates are per document/category. Low-suspicion matches do not count as positive predictions.",
  };
}
