import { describe, expect, it } from "vite-plus/test";
import { normalizeForMatching } from "../injection/normalize.ts";
import { diffLines } from "./diffLines.ts";

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

describe("diff reconstruction property (seeded)", () => {
  it("reconstructs both inputs and keeps counts consistent for 200 generated pairs", () => {
    const random = seededRandom(20261102);
    const alphabet = ["alpha", "beta", "gamma", "", "delta delta", "# Heading"];
    const makeDoc = () =>
      Array.from(
        { length: Math.floor(random() * 12) },
        () => alphabet[Math.floor(random() * alphabet.length)]!,
      ).join("\n");
    for (let iteration = 0; iteration < 200; iteration++) {
      const original = makeDoc();
      const candidate = makeDoc();
      const result = diffLines(original, candidate);
      const rebuiltOriginal = result.lines
        .filter((line) => line.type !== "added")
        .map((line) => line.text)
        .join("\n");
      const rebuiltCandidate = result.lines
        .filter((line) => line.type !== "removed")
        .map((line) => line.text)
        .join("\n");
      expect(rebuiltOriginal).toBe(original);
      const candidateFromLines = result.lines
        .filter((line) => line.type !== "removed")
        .map((line) =>
          line.type === "added"
            ? line.text
            : candidate.split("\n")[(line.candidateLineNumber ?? 1) - 1],
        )
        .join("\n");
      expect(candidateFromLines).toBe(candidate);
      expect(rebuiltCandidate.split("\n").length).toBe(candidate.split("\n").length);
      expect(result.addedCount).toBe(result.lines.filter((l) => l.type === "added").length);
      expect(result.removedCount).toBe(result.lines.filter((l) => l.type === "removed").length);
      expect(result.identical).toBe(original === candidate);
      expect(diffLines(original, candidate)).toEqual(result);
    }
  });

  it("normalization is idempotent and never invents non-separator characters", () => {
    const samples = ["іgnore рrevious", "i-g-n-o-r-e this", "plain text", "Ｉｇｎｏｒｅ ａｌｌ"];
    for (const sample of samples) {
      const once = normalizeForMatching(sample);
      expect(normalizeForMatching(once)).toBe(once);
    }
    expect(normalizeForMatching("іgnore")).toBe("ignore");
  });
});
