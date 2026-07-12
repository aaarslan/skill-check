import type { AnalyzableDocument } from "../../shared/markdown.ts";
import { scanPatterns, type PatternSpec } from "../scanPatterns.ts";
import type { InjectionFinding, InjectionRule } from "../types.ts";

const RULE_ID = "injection/data-exfiltration";

const PATTERNS: readonly PatternSpec[] = [
  {
    pattern: /\bread (?:the )?(?:contents? of )?(?:\/etc\/passwd|\.env\b)/iu,
    rationale: "Targets a sensitive local file (credentials or environment configuration).",
  },
  {
    pattern: /\b(?:read|access|dump|print) (?:the )?environment variables?\b/iu,
    rationale: "Requests reading process environment variables, which often hold secrets.",
  },
  {
    pattern: /\baccess (?:the )?(?:browser )?(?:local ?storage|session ?storage|cookies?)\b/iu,
    rationale: "Requests access to browser storage or cookies outside the skill's declared scope.",
  },
  {
    pattern: /\b(?:read|copy|access) (?:the )?clipboard\b/iu,
    rationale: "Requests reading or copying clipboard contents.",
  },
  {
    pattern: /\blist (?:all )?files? (?:on|in) (?:the )?(?:disk|system|home directory)\b/iu,
    rationale: "Requests enumerating unrelated files on the filesystem.",
  },
];

export const dataExfiltrationRule: InjectionRule = {
  id: RULE_ID,
  category: "data-exfiltration",
  description:
    "Detects requests to read unrelated files, environment variables, browser storage, or clipboard data.",
  evaluate(doc: AnalyzableDocument): InjectionFinding[] {
    return scanPatterns(doc, RULE_ID, "data-exfiltration", "high", PATTERNS);
  },
};
