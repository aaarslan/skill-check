import { describe, expect, it } from "vite-plus/test";
import { toAnalyzableDocument } from "../../shared/markdown.ts";
import { consistencyRules } from "./consistency.ts";

const [conflictingImperatives, excessiveRepetition, internalInconsistency] = consistencyRules;

describe("consistency/conflicting-imperatives", () => {
  it("flags an affirmative and a negated imperative about the same action", () => {
    const content = "Always delete temp files.\nNever delete temp files.\n";
    const findings = conflictingImperatives?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0]?.severity).toBe("high");
  });

  it("does not flag unrelated affirmative and negative statements", () => {
    const content = "Always greet the user politely.\nNever expose raw stack traces.\n";
    const findings = conflictingImperatives?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(0);
  });
});

describe("consistency/excessive-repetition", () => {
  it("flags a line repeated three or more times", () => {
    const line = "This is a repeated line for testing purposes.";
    const content = `${line}\n${line}\n${line}\n`;
    const findings = excessiveRepetition?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("3 times");
  });

  it("does not flag a line repeated only twice", () => {
    const line = "This is a repeated line for testing purposes.";
    const content = `${line}\n${line}\n`;
    const findings = excessiveRepetition?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(0);
  });
});

describe("consistency/internal-inconsistency", () => {
  it("flags a stated count that doesn't match the list that follows", () => {
    const content = "Follow the following three steps:\n\n1. First\n2. Second\n";
    const findings = internalInconsistency?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("three steps");
  });

  it("does not flag a stated count that matches the list", () => {
    const content = "Follow the following two steps:\n\n1. First\n2. Second\n";
    const findings = internalInconsistency?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(0);
  });
});

describe("consistency edge cases (bug hunt)", () => {
  const run = (content: string) =>
    consistencyRules.flatMap((rule) => rule.evaluate(toAnalyzableDocument(content)));
  it("flags a same-line direct contradiction with non-overlapping spans", () => {
    const findings = run("Always delete temporary logs but never delete temporary logs.\n").filter(
      (f) => f.ruleId === "consistency/conflicting-imperatives",
    );
    expect(findings.length).toBe(1);
  });
  it("does not self-pair a single negated imperative", () => {
    const findings = run("Never delete temporary logs.\n").filter(
      (f) => f.ruleId === "consistency/conflicting-imperatives",
    );
    expect(findings.length).toBe(0);
  });
  it("counts commands after a There-are claim", () => {
    const findings = run("There are two commands:\n\n1. alpha\n2. beta\n3. gamma\n").filter(
      (f) => f.ruleId === "consistency/internal-inconsistency",
    );
    expect(findings.length).toBe(1);
  });
});
