import { describe, expect, it } from "vite-plus/test";
import { evaluateCalibration } from "./evaluate.ts";

describe("calibration accounting", () => {
  it("uses separate category denominators and preserves mistakes", () => {
    const result = evaluateCalibration();
    expect(new Set(result.cases.map((item) => item.id)).size).toBe(result.cases.length);
    expect(result.categories.every((category) => category.positives > 0)).toBe(true);
    for (const category of result.categories) {
      expect(category.positives + category.negatives).toBe(result.cases.length);
      expect(category.truePositives + category.misses).toBe(category.positives);
      expect(category.falsePositiveRate).toBe(category.falsePositives / category.negatives);
      expect(category.missRate).toBe(category.misses / category.positives);
    }
    expect(result.cases.find((item) => item.id === "spaced-override")!.missed).toContain(
      "instruction-override",
    );
    expect(result.cases.some((item) => item.falsePositives.length)).toBe(true);
    expect(result).toEqual(evaluateCalibration());
  });
  it("represents an empty denominator as unavailable", () => {
    expect(
      evaluateCalibration([]).categories.every(
        (category) => category.falsePositiveRate === null && category.missRate === null,
      ),
    ).toBe(true);
  });
});
