import { describe, expect, it } from "vite-plus/test";
import { toAnalyzableDocument } from "../../shared/markdown.ts";
import { structureRules } from "./structure.ts";

const [longSection, ambiguousTerms, lowConcision] = structureRules;

describe("structure/long-section", () => {
  it("flags a paragraph over the word threshold", () => {
    const words = Array.from({ length: 160 }, (_, i) => `word${i}`).join(" ");
    const content = `${words}\n`;
    const findings = longSection?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it("does not flag a short paragraph", () => {
    const content = "This is a short paragraph well under the length threshold.\n";
    const findings = longSection?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(0);
  });
});

describe("structure/ambiguous-terms", () => {
  it("flags an ambiguous term with no accompanying criteria", () => {
    const content = "Handle the request properly.\n";
    const findings = ambiguousTerms?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(1);
    expect(findings[0]?.location?.line).toBe(1);
  });

  it("does not flag an ambiguous term qualified by a defined criterion", () => {
    const content = "Format the output appropriately, as defined in the style guide above.\n";
    const findings = ambiguousTerms?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(0);
  });
});

describe("structure/low-concision", () => {
  it("flags long prose with no structural markers", () => {
    const words = Array.from({ length: 600 }, (_, i) => `token${i}`).join(" ");
    const content = `${words}\n`;
    const findings = lowConcision?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it("does not flag well-structured, concise content", () => {
    const content = "# Title\n\n- Step one.\n- Step two.\n- Step three.\n";
    const findings = lowConcision?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(0);
  });
});
