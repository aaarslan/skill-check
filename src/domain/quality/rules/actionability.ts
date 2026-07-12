import type { AnalyzableDocument } from "../../shared/markdown.ts";
import { codeBlockLineSet, stripInlineCode } from "../../shared/markdown.ts";
import type { QualityFinding, QualityRule } from "../types.ts";

const VAGUE_PHRASES: RegExp[] = [
  /\bin general\b/iu,
  /\bconceptually\b/iu,
  /\bthe idea is\b/iu,
  /\bessentially\b/iu,
  /\btheoretically\b/iu,
  /\bin principle\b/iu,
  /\bgenerally speaking\b/iu,
  /\bat a high level\b/iu,
  /\bthe concept of\b/iu,
  /\bin a nutshell\b/iu,
];

const ACTION_LIST_ITEM =
  /^\s*(?:[-*+]|\d+[.)])\s+(?:\*\*)?(?:Run|Use|Call|Check|Read|Write|Verify|Open|Set|Create|Add|Remove|Ensure|Invoke|Execute|Load|Configure|Enable|Disable|Install|Update|Delete|Fetch|Send|Return|Validate|Parse|Confirm|Review|Search|Navigate|Click|Type|Select|Choose|Provide|Include|Avoid|Ask|Wait|Stop|Start)\b/iu;

const vagueInstructions: QualityRule = {
  id: "actionability/vague-instructions",
  category: "actionability",
  description: "Flags documents that lean on vague theory instead of concrete, actionable steps.",
  evaluate(doc: AnalyzableDocument): QualityFinding[] {
    const codeLines = codeBlockLineSet(doc);
    let actionableSteps = 0;
    const vagueMatches: { line: number; excerpt: string }[] = [];

    doc.lines.forEach((line, index) => {
      const lineNumber = index + 1;
      if (codeLines.has(lineNumber)) {
        return;
      }
      if (ACTION_LIST_ITEM.test(line)) {
        actionableSteps++;
      }
      const stripped = stripInlineCode(line);
      for (const pattern of VAGUE_PHRASES) {
        const match = pattern.exec(stripped);
        if (match) {
          vagueMatches.push({ line: lineNumber, excerpt: match[0] });
          break;
        }
      }
    });

    const firstVague = vagueMatches[0];
    if (actionableSteps === 0 && vagueMatches.length >= 2 && firstVague) {
      return [
        {
          ruleId: vagueInstructions.id,
          category: "actionability",
          severity: vagueMatches.length >= 4 ? "high" : "medium",
          message: "Instructions lean on vague theory rather than concrete steps",
          explanation: `Found ${vagueMatches.length} vague/theoretical phrase(s) (e.g. "${firstVague.excerpt}") and no actionable step list (bullet or numbered items starting with a concrete verb).`,
          suggestion:
            "Replace abstract descriptions with a concrete, ordered list of actions the reader should take.",
          location: firstVague,
        },
      ];
    }
    return [];
  },
};

const CONSTRAINT_PATTERNS: RegExp[] = [
  /\bdo not\b/iu,
  /\bdon't\b/iu,
  /\bnever\b/iu,
  /\bmust not\b/iu,
  /\bavoid\b/iu,
  /\bprohibited\b/iu,
  /\bnot allowed\b/iu,
  /\bshall not\b/iu,
  /\brefrain from\b/iu,
];

const hasConstraints: QualityRule = {
  id: "actionability/has-constraints",
  category: "actionability",
  description: "Checks for explicit constraints or prohibited behavior.",
  evaluate(doc: AnalyzableDocument): QualityFinding[] {
    const codeLines = codeBlockLineSet(doc);
    const found = doc.lines.some((line, index) => {
      if (codeLines.has(index + 1)) {
        return false;
      }
      const stripped = stripInlineCode(line);
      return CONSTRAINT_PATTERNS.some((pattern) => pattern.test(stripped));
    });
    if (found) {
      return [];
    }
    return [
      {
        ruleId: hasConstraints.id,
        category: "actionability",
        severity: "medium",
        message: "No explicit constraints or prohibited behavior found",
        explanation:
          'The document never states what must not be done (no "do not", "never", "must not", "avoid", or similar). Skills that omit constraints leave the boundary of acceptable behavior implicit.',
        suggestion: "Add an explicit constraints section listing prohibited actions or behaviors.",
        location: null,
      },
    ];
  },
};

const VERIFICATION_PATTERNS: RegExp[] = [
  /\bdone when\b/iu,
  /\bverify that\b/iu,
  /\bsuccess criteria\b/iu,
  /\bcompletion criteria\b/iu,
  /\bdefinition of done\b/iu,
  /\bacceptance criteria\b/iu,
  /\bcheck that\b/iu,
  /\bconfirm that\b/iu,
  /\bhave (?:completed|finished)\b/iu,
];

const hasVerificationCriteria: QualityRule = {
  id: "actionability/has-verification-criteria",
  category: "actionability",
  description: "Checks for verification or completion criteria.",
  evaluate(doc: AnalyzableDocument): QualityFinding[] {
    const codeLines = codeBlockLineSet(doc);
    const found = doc.lines.some((line, index) => {
      if (codeLines.has(index + 1)) {
        return false;
      }
      const stripped = stripInlineCode(line);
      return VERIFICATION_PATTERNS.some((pattern) => pattern.test(stripped));
    });
    if (found) {
      return [];
    }
    return [
      {
        ruleId: hasVerificationCriteria.id,
        category: "actionability",
        severity: "medium",
        message: "No verification or completion criteria found",
        explanation:
          'The document does not describe how to know the task is done correctly (no "done when", "verify that", "success criteria", or similar).',
        suggestion: "State explicit criteria for verifying the work is complete and correct.",
        location: null,
      },
    ];
  },
};

const ERROR_HANDLING_PATTERNS: RegExp[] = [
  /\bif (?:you )?(?:cannot|can't|are unable to)\b/iu,
  /\bif unclear\b/iu,
  /\bif missing\b/iu,
  /\bon error\b/iu,
  /\bif uncertain\b/iu,
  /\bask the user\b/iu,
  /\bif (?:the )?input is invalid\b/iu,
  /\bhandles? errors?\b/iu,
  /\bwhen (?:something )?(?:goes wrong|fails)\b/iu,
  /\bfallback\b/iu,
];

const hasErrorHandling: QualityRule = {
  id: "actionability/has-error-handling",
  category: "actionability",
  description: "Checks for handling of errors, uncertainty, or missing context.",
  evaluate(doc: AnalyzableDocument): QualityFinding[] {
    const codeLines = codeBlockLineSet(doc);
    const found = doc.lines.some((line, index) => {
      if (codeLines.has(index + 1)) {
        return false;
      }
      const stripped = stripInlineCode(line);
      return ERROR_HANDLING_PATTERNS.some((pattern) => pattern.test(stripped));
    });
    if (found) {
      return [];
    }
    return [
      {
        ruleId: hasErrorHandling.id,
        category: "actionability",
        severity: "medium",
        message: "No guidance for errors, uncertainty, or missing context",
        explanation:
          'The document never describes what to do when something is unclear, missing, or fails (no "if unclear", "on error", "ask the user", or similar).',
        suggestion:
          "Add guidance for how to behave when required context is missing or a step fails.",
        location: null,
      },
    ];
  },
};

export const actionabilityRules: readonly QualityRule[] = [
  vagueInstructions,
  hasConstraints,
  hasVerificationCriteria,
  hasErrorHandling,
];
