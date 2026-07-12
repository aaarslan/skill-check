import type { AnalyzableDocument } from "../../shared/markdown.ts";
import { scanPatterns, type PatternSpec } from "../scanPatterns.ts";
import type { InjectionFinding, InjectionRule } from "../types.ts";

const RULE_ID = "injection/secret-exfiltration";

const PATTERNS: readonly PatternSpec[] = [
  {
    pattern:
      /\breveal (?:the |your )?(?:system prompt|hidden (?:context|instructions)|api keys?|credentials?|secrets?)\b/iu,
    rationale: "Requests disclosure of system prompt, credentials, or other hidden context.",
  },
  {
    pattern: /\bshow (?:me )?(?:the |your )?(?:system prompt|hidden (?:instructions|context))\b/iu,
    rationale: "Requests the system prompt or hidden instructions be shown.",
  },
  {
    pattern: /\bwhat (?:is|are) your (?:system prompt|instructions|hidden (?:context|rules))\b/iu,
    rationale: "Asks the model to disclose its system prompt or hidden rules.",
  },
  {
    pattern: /\bprint (?:the |your )?(?:api keys?|passwords?|secrets?|tokens?|credentials?)\b/iu,
    rationale: "Requests secrets or credentials be printed.",
  },
  {
    pattern: /\bleak (?:the |your )?(?:system prompt|credentials?|secrets?)\b/iu,
    rationale: 'Uses "leak" language targeting the system prompt or credentials.',
  },
];

export const secretExfiltrationRule: InjectionRule = {
  id: RULE_ID,
  category: "secret-exfiltration",
  description:
    "Detects requests to reveal secrets, credentials, system prompts, or hidden context.",
  evaluate(doc: AnalyzableDocument): InjectionFinding[] {
    return scanPatterns(doc, RULE_ID, "secret-exfiltration", "high", PATTERNS);
  },
};
