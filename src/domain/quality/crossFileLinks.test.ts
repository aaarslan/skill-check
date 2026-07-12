import { describe, expect, it } from "vite-plus/test";
import { analyzeQuality } from "./analyze.ts";
import { findCrossFileLinkFindings, mergeAdditionalFindings } from "./crossFileLinks.ts";

describe("findCrossFileLinkFindings", () => {
  it("returns no findings when the sibling has no filename", () => {
    const findings = findCrossFileLinkFindings(
      { content: "[a](sibling.md#setup)\n", filename: null },
      { content: "## Setup\n", filename: null },
    );
    expect(findings).toHaveLength(0);
  });

  it("flags a link to the sibling file whose anchor doesn't resolve", () => {
    const findings = findCrossFileLinkFindings(
      { content: "See [setup](original.md#nonexistent) for details.\n", filename: "candidate.md" },
      { content: "## Setup\n", filename: "original.md" },
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe("integrity/cross-file-broken-link");
  });

  it("does not flag a link to the sibling file whose anchor does resolve", () => {
    const findings = findCrossFileLinkFindings(
      { content: "See [setup](original.md#setup) for details.\n", filename: "candidate.md" },
      { content: "## Setup\n", filename: "original.md" },
    );
    expect(findings).toHaveLength(0);
  });

  it("ignores links that target a different file entirely", () => {
    const findings = findCrossFileLinkFindings(
      { content: "See [x](unrelated.md#nonexistent) for details.\n", filename: "candidate.md" },
      { content: "## Setup\n", filename: "original.md" },
    );
    expect(findings).toHaveLength(0);
  });
});

describe("mergeAdditionalFindings", () => {
  it("recomputes category and overall scores after merging", () => {
    const base = analyzeQuality("# Title\n\nSome content.\n");
    const merged = mergeAdditionalFindings(base, [
      {
        ruleId: "integrity/cross-file-broken-link",
        category: "integrity",
        severity: "medium",
        message: "test",
        explanation: "test",
        suggestion: "test",
        location: null,
      },
    ]);
    expect(merged.findings.length).toBe(base.findings.length + 1);
    expect(merged.score).toBeLessThanOrEqual(base.score);
  });

  it("returns the same report instance when there is nothing to merge", () => {
    const base = analyzeQuality("# Title\n\nSome content.\n");
    const merged = mergeAdditionalFindings(base, []);
    expect(merged).toBe(base);
  });
});
