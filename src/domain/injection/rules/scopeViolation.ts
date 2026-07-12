import type { AnalyzableDocument } from "../../shared/markdown.ts";
import { scanPatterns, type PatternSpec } from "../scanPatterns.ts";
import type { InjectionFinding, InjectionRule } from "../types.ts";

const RULE_ID = "injection/scope-violation";

const PATTERNS: readonly PatternSpec[] = [
  {
    pattern: /\bregardless of (?:your|the) (?:instructions|guidelines|rules)\b/iu,
    rationale: "Claims to override instructions regardless of what they say.",
  },
  {
    pattern: /\bno matter what your instructions say\b/iu,
    rationale: "Explicitly claims priority over the reader's actual instructions.",
  },
  {
    pattern: /\byour (?:actual|real|true) (?:job|task|purpose) is\b/iu,
    rationale: "Attempts to redefine the reader's purpose away from its declared scope.",
  },
  {
    pattern:
      /this takes priority over (?:your|the) (?:other|previous|assigned) (?:instructions|task)\b/iu,
    rationale: "Claims priority over the reader's assigned task.",
  },
  {
    pattern: /\bin addition to (?:your|the) (?:task|instructions),? you must also\b/iu,
    rationale: "Appends an additional, unrelated obligation onto the declared task.",
    suspicion: "medium",
  },
  {
    pattern: /\bstep outside (?:your|the) (?:scope|role)\b/iu,
    rationale: "Directly asks to act outside the declared scope or role.",
    suspicion: "medium",
  },
];

export const scopeViolationRule: InjectionRule = {
  id: RULE_ID,
  category: "scope-violation",
  description:
    "Detects instructions that claim priority over, or fall outside, the skill's stated scope.",
  evaluate(doc: AnalyzableDocument): InjectionFinding[] {
    return scanPatterns(doc, RULE_ID, "scope-violation", "high", PATTERNS);
  },
};
