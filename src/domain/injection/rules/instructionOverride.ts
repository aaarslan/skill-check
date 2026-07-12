import type { AnalyzableDocument } from "../../shared/markdown.ts";
import { scanCrossLinePatterns, scanPatterns, type PatternSpec } from "../scanPatterns.ts";
import type { InjectionFinding, InjectionRule } from "../types.ts";

const RULE_ID = "injection/instruction-override";

const PATTERNS: readonly PatternSpec[] = [
  {
    pattern: /\bignore (?:all |any )?(?:previous|prior|above|earlier) instructions?\b/iu,
    rationale:
      "Classic instruction-hierarchy override: tells the reader to discard prior instructions.",
  },
  {
    pattern: /\bdisregard (?:all |any )?(?:previous|prior|above|earlier) instructions?\b/iu,
    rationale: "Instructs the reader to discard prior instructions.",
  },
  {
    pattern: /\bforget (?:all |any )?(?:previous|prior|your) instructions?\b/iu,
    rationale: "Instructs the reader to forget prior instructions.",
  },
  {
    pattern: /\boverride (?:your|the) (?:system|previous|prior) instructions?\b/iu,
    rationale: "Directly asks to override system or prior instructions.",
  },
  {
    pattern: /this (?:instruction|message|text) (?:takes|has) (?:priority|precedence) over\b/iu,
    rationale: "Claims priority over other instructions, a common override pattern.",
  },
  {
    pattern: /\bnew instructions? (?:supersede|replace|override)s?\b/iu,
    rationale: "Claims new instructions supersede existing ones.",
    suspicion: "medium",
  },
];

export const instructionOverrideRule: InjectionRule = {
  id: RULE_ID,
  category: "instruction-override",
  description: 'Detects "ignore previous instructions" style instruction-hierarchy overrides.',
  evaluate(doc: AnalyzableDocument): InjectionFinding[] {
    return [
      ...scanPatterns(doc, RULE_ID, "instruction-override", "high", PATTERNS),
      ...scanCrossLinePatterns(doc, RULE_ID, "instruction-override", "high", PATTERNS),
    ];
  },
};
