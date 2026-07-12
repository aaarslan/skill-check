import type { AnalyzableDocument } from "../../shared/markdown.ts";
import { scanPatterns, type PatternSpec } from "../scanPatterns.ts";
import type { InjectionFinding, InjectionRule } from "../types.ts";

const RULE_ID = "injection/fake-delimiter";

const PATTERNS: readonly PatternSpec[] = [
  {
    pattern: /<\s*system\s*>/iu,
    rationale: "Fake <system> delimiter mimicking a privileged message role.",
  },
  {
    pattern: /<\s*\/\s*system\s*>/iu,
    rationale: "Fake closing </system> delimiter.",
  },
  {
    pattern: /\bBEGIN SYSTEM PROMPT\b/iu,
    rationale: 'Fake "BEGIN SYSTEM PROMPT" delimiter used to imitate a system message boundary.',
  },
  {
    pattern: /\bEND SYSTEM PROMPT\b/iu,
    rationale: 'Fake "END SYSTEM PROMPT" delimiter.',
  },
  {
    pattern: /\[\s*\/?\s*INST\s*\]/iu,
    rationale: "Fake instruction-tag delimiter mimicking chat-template syntax.",
    suspicion: "medium",
  },
  {
    pattern: /<<\s*\/?\s*SYS\s*>>/iu,
    rationale: "Fake <<SYS>> delimiter mimicking chat-template syntax.",
    suspicion: "medium",
  },
  {
    pattern: /<\|im_(?:start|end)\|>/iu,
    rationale: "Fake ChatML delimiter used to imitate a role boundary.",
  },
  {
    pattern: /"role"\s*:\s*"(?:system|assistant|tool)"/iu,
    rationale: "Fake JSON message object impersonating a system, assistant, or tool role.",
  },
  {
    pattern: /\btool_call\b\s*[:(]/iu,
    rationale: "Mimics tool-call syntax to inject a fake function invocation.",
    suspicion: "medium",
  },
];

export const fakeDelimiterRule: InjectionRule = {
  id: RULE_ID,
  category: "fake-delimiter",
  description:
    'Detects fake role/system delimiters such as <system>, "BEGIN SYSTEM PROMPT", or tool-call syntax.',
  evaluate(doc: AnalyzableDocument): InjectionFinding[] {
    return scanPatterns(doc, RULE_ID, "fake-delimiter", "high", PATTERNS);
  },
};
