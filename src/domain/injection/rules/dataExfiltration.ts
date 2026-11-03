import type { AnalyzableDocument } from "../../shared/markdown.ts";
import { scanCrossLinePatterns, scanPatterns, type PatternSpec } from "../scanPatterns.ts";
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
  {
    pattern:
      /\b(?:send|upload|transmit|post|forward|report)\b[^.\n]{0,60}\b(?:conversation|chat history|user(?:'s)? (?:data|messages|files)|personal data|private data|all (?:the )?data)\b[^.\n]{0,40}\b(?:to|via)\b[^.\n]{0,40}(?:https?:|endpoint|server|webhook|url)/iu,
    rationale: "Directs conversation or user data to an external endpoint.",
  },
  {
    pattern:
      /\b(?:place|put|include|embed|encode|append)\b[^.\n]{0,50}\b(?:conversation|chat|user data|personal data|confidential|secret)\b[^.\n]{0,50}\b(?:query (?:parameter|string)|tracking pixel|image (?:url|src)|url)\b/iu,
    rationale: "Smuggles data out through a URL, query parameter, or tracking pixel.",
  },
  {
    pattern:
      /\bmarkdown image\b[^.\n]{0,80}\b(?:conversation|user|secret|data)\b[^.\n]{0,40}\b(?:query|url|parameter)\b/iu,
    rationale: "Uses a rendered Markdown image URL as an exfiltration channel.",
  },
];

export const dataExfiltrationRule: InjectionRule = {
  id: RULE_ID,
  category: "data-exfiltration",
  description:
    "Detects requests to read unrelated files, environment variables, browser storage, or clipboard data.",
  evaluate(doc: AnalyzableDocument): InjectionFinding[] {
    return [
      ...scanPatterns(doc, RULE_ID, "data-exfiltration", "high", PATTERNS),
      ...scanCrossLinePatterns(doc, RULE_ID, "data-exfiltration", "high", PATTERNS),
    ];
  },
};
