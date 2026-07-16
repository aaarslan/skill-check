import type { AnalyzableDocument } from "../../shared/markdown.ts";
import { codeBlockLineSet, parseHeadings, stripInlineCode } from "../../shared/markdown.ts";
import type { QualityFinding, QualityRule } from "../types.ts";

// URL group tolerates one level of nested parens (e.g. javascript:alert(1)) and an
// empty target (`]()`), instead of stopping at the first ")" and requiring 1+ chars.
const LINK_PATTERN = /\[([^\]]*)\]\(((?:[^()]|\([^()]*\))*)\)/gu;

const brokenRelativeLinks: QualityRule = {
  id: "integrity/broken-relative-links",
  category: "integrity",
  description:
    "Flags empty link targets and same-document anchor links that don't match any heading.",
  evaluate(doc: AnalyzableDocument): QualityFinding[] {
    const codeLines = codeBlockLineSet(doc);
    const headingSlugs = new Set(parseHeadings(doc).map((heading) => heading.slug));
    const findings: QualityFinding[] = [];

    doc.lines.forEach((line, index) => {
      const lineNumber = index + 1;
      if (codeLines.has(lineNumber)) {
        return;
      }
      for (const match of line.matchAll(LINK_PATTERN)) {
        const target = (match[2] ?? "").trim();

        if (target.length === 0) {
          findings.push({
            ruleId: brokenRelativeLinks.id,
            category: "integrity",
            severity: "medium",
            message: "Link has an empty target",
            explanation: `The link [${match[1] ?? ""}]() at line ${lineNumber} has no destination.`,
            suggestion: "Add a destination, or remove the link.",
            location: { line: lineNumber, excerpt: match[0] },
          });
          continue;
        }

        // Only same-document anchors are evaluable from a single supplied file;
        // external URLs and unrelated relative paths can't be resolved without a filesystem.
        if (!target.startsWith("#") || target.length <= 1) {
          continue;
        }
        const slug = target.slice(1).toLowerCase();
        if (headingSlugs.has(slug)) {
          continue;
        }
        findings.push({
          ruleId: brokenRelativeLinks.id,
          category: "integrity",
          severity: "medium",
          message: `Link target "${target}" does not match any heading`,
          explanation: `The link [${match[1] ?? ""}](${target}) at line ${lineNumber} references an anchor that doesn't correspond to any heading in this document.`,
          suggestion: "Point the link at an existing heading, or remove it.",
          location: { line: lineNumber, excerpt: match[0] },
        });
      }
    });

    return findings;
  },
};

const REFERENCE_LINK_PATTERN = /\[([^\]]+)\]\[([^\]]*)\]/gu;
const REFERENCE_DEFINITION_PATTERN = /^[ \t]{0,3}\[([^\]]+)\]:\s*\S+/u;

const undefinedReferenceLinks: QualityRule = {
  id: "integrity/undefined-reference-link",
  category: "integrity",
  description:
    "Flags reference-style links (`[text][ref]`) with no matching `[ref]: url` definition.",
  evaluate(doc: AnalyzableDocument): QualityFinding[] {
    const codeLines = codeBlockLineSet(doc);
    const definedRefs = new Set<string>();
    doc.lines.forEach((line, index) => {
      if (codeLines.has(index + 1)) {
        return;
      }
      const match = REFERENCE_DEFINITION_PATTERN.exec(line);
      if (match) {
        definedRefs.add((match[1] ?? "").trim().toLowerCase());
      }
    });

    const findings: QualityFinding[] = [];
    doc.lines.forEach((line, index) => {
      const lineNumber = index + 1;
      if (codeLines.has(lineNumber)) {
        return;
      }
      for (const match of line.matchAll(REFERENCE_LINK_PATTERN)) {
        const linkText = match[1] ?? "";
        const explicitRef = (match[2] ?? "").trim();
        const ref = (explicitRef.length > 0 ? explicitRef : linkText).trim().toLowerCase();
        if (definedRefs.has(ref)) {
          continue;
        }
        findings.push({
          ruleId: undefinedReferenceLinks.id,
          category: "integrity",
          severity: "medium",
          message: `Reference link "${match[0]}" has no matching definition`,
          explanation: `Line ${lineNumber} uses a reference-style link with no corresponding "[${ref}]: <url>" definition anywhere in the document.`,
          suggestion: `Add a "[${ref}]: <url>" definition, or switch to an inline link.`,
          location: { line: lineNumber, excerpt: match[0] },
        });
      }
    });

    return findings;
  },
};

const BROAD_PERMISSION_PATTERNS: RegExp[] = [
  /\bfull access\b/iu,
  /\broot access\b/iu,
  /\badmin(?:istrator)? rights\b/iu,
  /\bunrestricted access\b/iu,
  /\bany file (?:on|in) the system\b/iu,
  /\ball files (?:on|in) the system\b/iu,
  /\bfull control\b/iu,
  /\bwithout (?:asking|confirmation|user approval)\b/iu,
  /\bbypass (?:all )?restrictions\b/iu,
  /\bsudo\b/iu,
  /\bfull system access\b/iu,
  /\bdelete any file\b/iu,
  /\bmodify any file\b/iu,
];

const broadPermissions: QualityRule = {
  id: "integrity/broad-permissions",
  category: "integrity",
  description: "Flags language suggesting suspiciously broad permissions or authority.",
  evaluate(doc: AnalyzableDocument): QualityFinding[] {
    const codeLines = codeBlockLineSet(doc);
    const findings: QualityFinding[] = [];

    doc.lines.forEach((line, index) => {
      const lineNumber = index + 1;
      if (codeLines.has(lineNumber)) {
        return;
      }
      const prose = stripInlineCode(line);
      for (const pattern of BROAD_PERMISSION_PATTERNS) {
        const match = pattern.exec(prose);
        if (match) {
          findings.push({
            ruleId: broadPermissions.id,
            category: "integrity",
            severity: "high",
            message: `Broad permission claim: "${match[0]}"`,
            explanation: `Line ${lineNumber} claims broad authority ("${match[0]}"), which is disproportionate for most skill scopes and worth double-checking.`,
            suggestion:
              "Scope the permission down to exactly what the skill needs, or justify the broad access explicitly.",
            location: { line: lineNumber, excerpt: match[0] },
          });
        }
      }
    });

    return findings;
  },
};

export const integrityRules: readonly QualityRule[] = [
  brokenRelativeLinks,
  undefinedReferenceLinks,
  broadPermissions,
];
