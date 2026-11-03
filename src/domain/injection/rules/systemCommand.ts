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
  {
    pattern: /\brm\s+-[a-z]*r[a-z]*f\b|\brm\s+-[a-z]*f[a-z]*r\b/iu,
    rationale: "Recursive forced deletion command (rm -rf).",
    suspicion: "medium",
  },
  {
    pattern: /\b(?:curl|wget)\b[^|\n]{0,120}?\|\s*(?:sudo\s+)?(?:sh|bash|zsh)\b/iu,
    rationale: "Pipes a remote download directly into a shell for execution.",
  },
  {
    pattern: /\b(?:mkfs|dd\s+if=|chmod\s+(?:777|a\+rwx)|chown\s+-R\s+root|:\(\)\s*\{)/iu,
    rationale: "Destructive or privilege-escalating shell construct.",
    suspicion: "medium",
  },
  {
    pattern:
      /\brm\s+(?:--recursive\b[^.\n]{0,30}--force\b|--force\b[^.\n]{0,30}--recursive\b|-[a-z]*r[a-z]*\s+-[a-z]*f|-[a-z]*f[a-z]*\s+-[a-z]*r)/iu,
    rationale: "Recursive forced deletion command with split or long-form flags.",
    suspicion: "medium",
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
