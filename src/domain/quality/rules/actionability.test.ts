import { describe, expect, it } from "vite-plus/test";
import { toAnalyzableDocument } from "../../shared/markdown.ts";
import { actionabilityRules } from "./actionability.ts";

const [vagueInstructions, hasConstraints, hasVerificationCriteria, hasErrorHandling] =
  actionabilityRules;

describe("actionability/vague-instructions", () => {
  it("flags prose that leans on vague theory with no concrete steps", () => {
    const content =
      "In general, the assistant should understand user intent.\n" +
      "Conceptually, the skill helps with writing.\n" +
      "Essentially, it just helps out.\n";
    const findings = vagueInstructions?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("medium");
  });

  it("passes when the document has a concrete action list even with some vague phrasing", () => {
    const content = "- Run the linter\n- Check the output\n\nIn general this helps.\n";
    const findings = vagueInstructions?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(0);
  });
});

describe("actionability/has-constraints", () => {
  it("flags a document with no stated constraints", () => {
    const content = "Do whatever seems best.\n";
    const findings = hasConstraints?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(1);
  });

  it("passes when a constraint is stated", () => {
    const content = "Do not delete files without confirmation.\n";
    const findings = hasConstraints?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(0);
  });
});

describe("actionability/has-verification-criteria", () => {
  it("flags a document with no verification criteria", () => {
    const content = "Write the summary and stop.\n";
    const findings = hasVerificationCriteria?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(1);
  });

  it("passes when completion criteria are stated", () => {
    const content = "Verify that the tests pass before finishing.\n";
    const findings = hasVerificationCriteria?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(0);
  });
});

describe("actionability/has-error-handling", () => {
  it("flags a document with no error/uncertainty handling", () => {
    const content = "Write the summary.\n";
    const findings = hasErrorHandling?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(1);
  });

  it("passes when guidance for missing context is present", () => {
    const content = "If unclear, ask the user for clarification before proceeding.\n";
    const findings = hasErrorHandling?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(0);
  });
});
