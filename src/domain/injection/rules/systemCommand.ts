import type { AnalyzableDocument } from "../../shared/markdown.ts";
import { scanPatterns, type PatternSpec } from "../scanPatterns.ts";
import type { InjectionFinding, InjectionRule } from "../types.ts";

const RULE_ID = "injection/system-command";

const PATTERNS: readonly PatternSpec[] = [
  {
    pattern: /\bexecute (?:this |the following )?(?:command|script|code)\b/iu,
    rationale: "Directs execution of an embedded command or script.",
  },
  {
    pattern: /\brun (?:this |the following )?(?:shell|bash|command)\b/iu,
    rationale: "Directs execution of a shell command.",
  },
  {
    pattern: /\binstall (?:new )?software\b/iu,
    rationale: "Requests installing software outside the skill's declared scope.",
    suspicion: "medium",
  },
  {
    pattern: /\b(?:curl|wget)\s+https?:\/\/\S+/iu,
    rationale:
      "Fetches a remote URL via a shell command, a common exfiltration or payload-download vector.",
    suspicion: "medium",
  },
  {
    pattern: /\bcontact (?:an? )?external (?:server|service|api)\b/iu,
    rationale: "Requests contacting an external service.",
  },
  {
    pattern: /\bsend (?:this |the )?data to\b[^.\n]{0,30}(?:https?:|server|endpoint)/iu,
    rationale: "Directs sending data to an external endpoint.",
  },
  {
    pattern: /\bexfiltrate\b/iu,
    rationale: 'Uses the word "exfiltrate" directly.',
  },
];

export const systemCommandRule: InjectionRule = {
  id: RULE_ID,
  category: "system-command",
  description:
    "Detects requests to execute commands, install software, contact external services, or exfiltrate data.",
  evaluate(doc: AnalyzableDocument): InjectionFinding[] {
    return scanPatterns(doc, RULE_ID, "system-command", "high", PATTERNS);
  },
};
