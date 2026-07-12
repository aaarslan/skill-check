import type { AnalyzableDocument } from "../shared/markdown.ts";
import { codeBlockLineSet } from "../shared/markdown.ts";
import { downgradeSuspicionTier } from "./suspicion.ts";
import type { InjectionCategory, InjectionFinding } from "./types.ts";

// If a category's findings recur across this fraction of prose lines (or more), the
// pattern reads as topical vocabulary for the document's subject matter (e.g. a
// shell-tooling skill legitimately saying "execute" often) rather than an isolated
// attack attempt. Concentration, not mere presence, is the injection signal.
const DENSITY_THRESHOLD = 0.15;
// Don't dampen on a handful of findings — the ratio is meaningless at low sample sizes.
const MIN_FINDINGS_FOR_DAMPENING = 3;

/**
 * Downgrades low/medium findings in categories that fire densely across a
 * document's prose. High-severity findings are never touched — this only
 * softens the noisier, lower-confidence tiers.
 */
export function applyCategoryDensityDampening(
  doc: AnalyzableDocument,
  findings: readonly InjectionFinding[],
): InjectionFinding[] {
  const codeLines = codeBlockLineSet(doc);
  const proseLineCount = doc.lines.filter(
    (line, index) => !codeLines.has(index + 1) && line.trim().length > 0,
  ).length;
  if (proseLineCount === 0) {
    return findings.slice();
  }

  const countByCategory = new Map<InjectionCategory, number>();
  for (const finding of findings) {
    countByCategory.set(finding.category, (countByCategory.get(finding.category) ?? 0) + 1);
  }

  return findings.map((finding) => {
    if (finding.suspicion === "high") {
      return finding;
    }
    const count = countByCategory.get(finding.category) ?? 0;
    if (count < MIN_FINDINGS_FOR_DAMPENING || count / proseLineCount < DENSITY_THRESHOLD) {
      return finding;
    }
    return {
      ...finding,
      suspicion: downgradeSuspicionTier(finding.suspicion),
      rationale: `${finding.rationale} (this pattern recurs across ${count} lines of this document, which reads as topical vocabulary rather than an isolated attempt, so suspicion was reduced)`,
    };
  });
}
