import { parseHeadings, toAnalyzableDocument } from "../shared/markdown.ts";
import { computeCategoryScores, computeOverallScore } from "./scoring.ts";
import type { QualityFinding, QualityReport } from "./types.ts";

export interface CrossFileLinkDocument {
  readonly content: string;
  readonly filename: string | null;
}

const LINK_PATTERN = /\[([^\]]*)\]\(((?:[^()]|\([^()]*\))*)\)/gu;

function basename(path: string): string {
  return path.replace(/^\.\//u, "").replace(/^.*\//u, "").toLowerCase();
}

/**
 * A single-file QualityRule can only validate anchors within its own document.
 * This resolves links in `source` that explicitly target `sibling`'s filename
 * (e.g. `[setup](original.md#setup)`) against the sibling's actual headings —
 * only possible once both documents are available, i.e. at comparison time.
 */
export function findCrossFileLinkFindings(
  source: CrossFileLinkDocument,
  sibling: CrossFileLinkDocument,
): QualityFinding[] {
  if (!sibling.filename) {
    return [];
  }
  const siblingBasename = basename(sibling.filename);
  const siblingSlugs = new Set(
    parseHeadings(toAnalyzableDocument(sibling.content)).map((h) => h.slug),
  );
  const sourceDoc = toAnalyzableDocument(source.content);
  const findings: QualityFinding[] = [];

  sourceDoc.lines.forEach((line, index) => {
    const lineNumber = index + 1;
    for (const match of line.matchAll(LINK_PATTERN)) {
      const target = (match[2] ?? "").trim();
      const hashIndex = target.indexOf("#");
      if (hashIndex <= 0) {
        continue;
      }
      const pathPart = target.slice(0, hashIndex);
      const fragment = target.slice(hashIndex + 1).toLowerCase();
      if (fragment.length === 0 || basename(pathPart) !== siblingBasename) {
        continue;
      }
      if (siblingSlugs.has(fragment)) {
        continue;
      }
      findings.push({
        ruleId: "integrity/cross-file-broken-link",
        category: "integrity",
        severity: "medium",
        message: `Link target "${target}" does not match any heading in ${sibling.filename}`,
        explanation: `The link [${match[1] ?? ""}](${target}) at line ${lineNumber} points at "${sibling.filename}", but that file has no heading matching "#${fragment}".`,
        suggestion: `Point the link at an existing heading in ${sibling.filename}, or remove it.`,
        location: { line: lineNumber, excerpt: match[0] },
      });
    }
  });

  return findings;
}

/** Appends additional findings to a report and recomputes its scores, so a report stays internally consistent. */
export function mergeAdditionalFindings(
  report: QualityReport,
  additional: readonly QualityFinding[],
): QualityReport {
  if (additional.length === 0) {
    return report;
  }
  const findings = [...report.findings, ...additional];
  const categoryScores = computeCategoryScores(findings);
  return { score: computeOverallScore(categoryScores), categoryScores, findings };
}
