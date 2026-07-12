import type { AnalyzableDocument } from "../../shared/markdown.ts";
import { scanPatterns, type PatternSpec } from "../scanPatterns.ts";
import type { InjectionFinding, InjectionRule } from "../types.ts";

const RULE_ID = "injection/impersonation";

const PATTERNS: readonly PatternSpec[] = [
  {
    pattern: /\b(?:i am|this is)(?: the)? (?:system|developer|administrator|admin)\b/iu,
    rationale: "Claims to be the system, developer, or administrator, an impersonation attempt.",
  },
  {
    pattern: /^\s*(?:system|developer|admin)\s*:/imu,
    rationale:
      'Line opens with a "System:"/"Developer:"/"Admin:" label, mimicking a privileged message role.',
    suspicion: "medium",
  },
  {
    pattern:
      /\bas (?:the )?(?:system|developer|administrator)\b[^.\n]{0,20}\b(?:instruct|tell|command)/iu,
    rationale: "Speaks as the system/developer/administrator while issuing a directive.",
  },
  {
    pattern: /\bacting as (?:the )?(?:system|developer|admin)\b/iu,
    rationale: "Explicitly claims to act as a privileged role.",
  },
];

export const impersonationRule: InjectionRule = {
  id: RULE_ID,
  category: "impersonation",
  description:
    "Detects attempts to impersonate system, developer, administrator, or tool messages.",
  evaluate(doc: AnalyzableDocument): InjectionFinding[] {
    return scanPatterns(doc, RULE_ID, "impersonation", "high", PATTERNS);
  },
};
