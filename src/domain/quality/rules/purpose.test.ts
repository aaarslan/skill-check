import { describe, expect, it } from "vite-plus/test";
import { toAnalyzableDocument } from "../../shared/markdown.ts";
import { purposeRules } from "./purpose.ts";

const [hasPurposeStatement, hasTriggerGuidance] = purposeRules;

describe("purpose/has-purpose-statement", () => {
  it("passes when frontmatter has both name and description", () => {
    const content =
      "---\nname: My Skill\ndescription: Does something useful for the user\n---\n\nBody text.\n";
    const findings = hasPurposeStatement?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(0);
  });

  it("passes when a heading is followed by a substantive intro paragraph", () => {
    const content = "# My Skill\n\nThis skill helps the user summarize long documents quickly.\n";
    const findings = hasPurposeStatement?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(0);
  });

  it("flags a document with no heading and no frontmatter", () => {
    const content = "Just some unstructured text without any real header.\n";
    const findings = hasPurposeStatement?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("high");
  });
});

describe("purpose/has-trigger-guidance", () => {
  it("passes when the document states when to use the skill", () => {
    const content = "# Skill\n\nUse this skill when the user asks to summarize a PDF.\n";
    const findings = hasTriggerGuidance?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(0);
  });

  it("flags a document with no trigger guidance", () => {
    const content = "# Skill\n\nThis skill summarizes PDFs.\n";
    const findings = hasTriggerGuidance?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(1);
  });
});
