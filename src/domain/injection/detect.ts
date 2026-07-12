import { toAnalyzableDocument } from "../shared/markdown.ts";
import { applyCategoryDensityDampening } from "./densityDampening.ts";
import { allInjectionRules } from "./rules/index.ts";
import type { InjectionFinding } from "./types.ts";

/**
 * Runs every heuristic prompt-injection rule against the given markdown
 * content. Pattern matching only: it never executes or otherwise acts on
 * the content it inspects.
 */
export function detectInjection(content: string): InjectionFinding[] {
  const doc = toAnalyzableDocument(content);
  const findings = allInjectionRules.flatMap((rule) => rule.evaluate(doc));
  return applyCategoryDensityDampening(doc, findings);
}

/** Number of high-suspicion findings — the headline signal surfaced in summaries and badges. */
export function countHighSuspicion(findings: readonly InjectionFinding[]): number {
  return findings.filter((finding) => finding.suspicion === "high").length;
}
