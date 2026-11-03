import type { AnalyzableDocument } from "../../shared/markdown.ts";
import { codeBlockLineSet } from "../../shared/markdown.ts";
import { downgradeIfDescriptive, isDescriptiveFraming } from "../mood.ts";
import { normalizeForMatching } from "../normalize.ts";
import {
  downgradeIfQuoted,
  isLikelyQuotedContext,
  prepareQuotedChecker,
} from "../quotedContext.ts";
import { scanPatterns, type PatternSpec } from "../scanPatterns.ts";
import { upgradeSuspicionTier } from "../suspicion.ts";
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
    pattern: /\b(?:curl|wget)\b[^|\n]{0,120}?\|\s*(?:sudo\s+)?(?:sh|bash|zsh)\b/iu,
    rationale: "Pipes a remote download directly into a shell for execution.",
  },
  {
    pattern: /\b(?:mkfs|dd\s+if=|chmod\s+(?:777|a\+rwx)|chown\s+-R\s+root|:\(\)\s*\{)/iu,
    rationale: "Destructive or privilege-escalating shell construct.",
    suspicion: "medium",
  },
];

const RM_RATIONALE = "Recursive forced deletion command (rm -rf).";
const RM_OBFUSCATED_SUFFIX =
  " (only matched after normalizing lookalike characters or separators — likely obfuscated)";
const RM_FLAG_LOOKAHEAD = 6;
const RM_SEPARATORS = new Set([";", "&&", "||", "|", "&"]);
const RM_WHITESPACE = /\s/;

interface RmToken {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

function tokenizeLine(line: string): RmToken[] {
  const tokens: RmToken[] = [];
  let index = 0;
  while (index < line.length) {
    while (index < line.length && RM_WHITESPACE.test(line.charAt(index))) {
      index += 1;
    }
    if (index >= line.length) {
      break;
    }
    const start = index;
    while (index < line.length && !RM_WHITESPACE.test(line.charAt(index))) {
      index += 1;
    }
    tokens.push({ text: line.slice(start, index), start, end: index });
  }
  return tokens;
}

function isRmToken(text: string): boolean {
  const base = text.slice(text.lastIndexOf("/") + 1);
  return (
    base.length === 2 &&
    (base.charCodeAt(0) === 114 || base.charCodeAt(0) === 82) &&
    (base.charCodeAt(1) === 109 || base.charCodeAt(1) === 77)
  );
}

function isLongFlag(text: string, name: string): boolean {
  if (text.length < name.length) return false;
  if (text.length > name.length && text.charAt(name.length) !== "=") return false;
  return text.slice(0, name.length).toLowerCase() === name;
}

function scanClusterFlags(token: string): { recursive: boolean; force: boolean } {
  let recursive = false;
  let force = false;
  for (let i = 1; i < token.length; i += 1) {
    const code = token.charCodeAt(i);
    if (code === 114 || code === 82) {
      recursive = true;
    } else if (code === 102 || code === 70) {
      force = true;
    }
    if (recursive && force) {
      break;
    }
  }
  return { recursive, force };
}

interface RmMatch {
  readonly matchIndex: number;
  readonly matchEnd: number;
}

function scanRmLine(line: string): RmMatch[] {
  const tokens = tokenizeLine(line);
  const matches: RmMatch[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === undefined || !isRmToken(token.text)) {
      continue;
    }
    let recursive = false;
    let force = false;
    let matchEnd = token.end;
    for (let j = i + 1; j < tokens.length && j <= i + RM_FLAG_LOOKAHEAD; j += 1) {
      const flag = tokens[j];
      if (flag === undefined) {
        break;
      }
      if (RM_SEPARATORS.has(flag.text)) {
        break;
      }
      if (!flag.text.startsWith("-")) {
        break;
      }
      matchEnd = flag.end;
      if (isLongFlag(flag.text, "--recursive")) {
        recursive = true;
      } else if (isLongFlag(flag.text, "--force")) {
        force = true;
      } else if (!flag.text.startsWith("--")) {
        const found = scanClusterFlags(flag.text);
        recursive = recursive || found.recursive;
        force = force || found.force;
      }
    }
    if (recursive && force) {
      matches.push({ matchIndex: token.start, matchEnd });
    }
  }
  return matches;
}

function scanRmFlags(doc: AnalyzableDocument): InjectionFinding[] {
  const codeLines = codeBlockLineSet(doc);
  const findings: InjectionFinding[] = [];
  doc.lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const quotedAt = prepareQuotedChecker(doc, lineNumber, codeLines);
    const rawMatches = scanRmLine(line);
    for (const match of rawMatches) {
      const matchedText = line.slice(match.matchIndex, match.matchEnd);
      const quoted = quotedAt(match.matchIndex, matchedText.length);
      const descriptive = isDescriptiveFraming(line, match.matchIndex);
      findings.push({
        id: `${RULE_ID}:${lineNumber}:${match.matchIndex}`,
        ruleId: RULE_ID,
        category: "system-command",
        suspicion: downgradeIfDescriptive(downgradeIfQuoted("medium", quoted), descriptive),
        matchedText,
        location: { line: lineNumber, excerpt: matchedText },
        rationale: RM_RATIONALE,
        isQuotedExample: quoted,
      });
    }
    if (rawMatches.length > 0) {
      return;
    }
    const normalizedLine = normalizeForMatching(line);
    if (normalizedLine === line) {
      return;
    }
    const normalizedMatch = scanRmLine(normalizedLine)[0];
    if (normalizedMatch === undefined) {
      return;
    }
    const quoted = isLikelyQuotedContext(
      doc,
      lineNumber,
      codeLines,
      normalizedMatch.matchIndex,
      normalizedMatch.matchEnd - normalizedMatch.matchIndex,
    );
    const descriptive = isDescriptiveFraming(normalizedLine, normalizedMatch.matchIndex);
    findings.push({
      id: `${RULE_ID}:${lineNumber}:obfuscated:${normalizedMatch.matchIndex}`,
      ruleId: RULE_ID,
      category: "system-command",
      suspicion: downgradeIfDescriptive(
        downgradeIfQuoted(upgradeSuspicionTier("medium"), quoted),
        descriptive,
      ),
      matchedText: line.trim(),
      location: { line: lineNumber, excerpt: line.trim().slice(0, 100) },
      rationale: `${RM_RATIONALE}${RM_OBFUSCATED_SUFFIX}`,
      isQuotedExample: quoted,
    });
  });
  return findings;
}

export const systemCommandRule: InjectionRule = {
  id: RULE_ID,
  category: "system-command",
  description:
    "Detects requests to execute commands, install software, contact external services, or exfiltrate data.",
  evaluate(doc: AnalyzableDocument): InjectionFinding[] {
    return [...scanPatterns(doc, RULE_ID, "system-command", "high", PATTERNS), ...scanRmFlags(doc)];
  },
};
