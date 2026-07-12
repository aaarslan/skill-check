import type { AnalyzableDocument } from "../../shared/markdown.ts";
import { scanCrossLinePatterns, scanPatterns, type PatternSpec } from "../scanPatterns.ts";
import type { InjectionFinding, InjectionRule } from "../types.ts";

const RULE_ID = "injection/safety-disable";

const PATTERNS: readonly PatternSpec[] = [
  {
    pattern: /\bdisable (?:all )?(?:safety|security)(?: checks?| features?| measures?)?\b/iu,
    rationale: "Directs disabling safety or security checks.",
  },
  {
    pattern: /\bskip (?:the )?(?:verification|confirmation|authorization|approval)\b/iu,
    rationale: "Directs skipping verification, confirmation, or authorization steps.",
  },
  {
    pattern: /\bbypass (?:the )?(?:safety|security|authorization|approval)\b/iu,
    rationale: "Directs bypassing safety, security, or authorization controls.",
  },
  {
    pattern: /\bturn off (?:safety|security|filters?)\b/iu,
    rationale: "Directs turning off safety or security filters.",
  },
  {
    pattern:
      /\byou (?:don't|do not) need (?:the user'?s? )?(?:permission|approval|confirmation)\b/iu,
    rationale: "Claims user permission or confirmation is unnecessary.",
  },
  {
    pattern: /\bwithout (?:asking|confirming|verifying)\b/iu,
    rationale: "Directs proceeding without asking, confirming, or verifying first.",
    suspicion: "medium",
  },
];

export const safetyDisableRule: InjectionRule = {
  id: RULE_ID,
  category: "safety-disable",
  description:
    "Detects attempts to disable safety, verification, authorization, or user confirmation.",
  evaluate(doc: AnalyzableDocument): InjectionFinding[] {
    return [
      ...scanPatterns(doc, RULE_ID, "safety-disable", "high", PATTERNS),
      ...scanCrossLinePatterns(doc, RULE_ID, "safety-disable", "high", PATTERNS),
    ];
  },
};
