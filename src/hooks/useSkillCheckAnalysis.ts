import { useMemo } from "react";
import { compareQualityReports, type QualityComparison } from "../domain/quality/compare.ts";
import { analyzeReview, type Review } from "../domain/review/analyze.ts";
import { diffLines } from "../domain/diff/diffLines.ts";
import type { DiffResult } from "../domain/diff/types.ts";
import { useFileLoader, type FileLoaderApi } from "./useFileLoader.ts";

export type AnalyzedSlot = Review["documents"][number];
export type AnalysisView =
  | { readonly kind: "empty" }
  | { readonly kind: "original-only"; readonly original: AnalyzedSlot }
  | { readonly kind: "candidate-only"; readonly candidate: AnalyzedSlot }
  | {
      readonly kind: "both";
      readonly original: AnalyzedSlot;
      readonly candidate: AnalyzedSlot;
      readonly diff: DiffResult;
      readonly comparison: QualityComparison;
    };
export interface SkillCheckAnalysis {
  readonly original: FileLoaderApi;
  readonly candidate: FileLoaderApi;
  readonly view: AnalysisView;
  readonly report: Review | null;
}

/** Revisions are independent documents; only package review resolves sibling links. */
export function useSkillCheckAnalysis(ignoreWhitespace: boolean): SkillCheckAnalysis {
  const original = useFileLoader();
  const candidate = useFileLoader();
  const originalFile = original.state.status === "loaded" ? original.state.file : null;
  const candidateFile = candidate.state.status === "loaded" ? candidate.state.file : null;
  const report = useMemo(() => {
    const sources = [
      ...(originalFile
        ? [
            {
              path: `original/${originalFile.filename ?? "SKILL.md"}`,
              content: originalFile.content,
            },
          ]
        : []),
      ...(candidateFile
        ? [
            {
              path: `candidate/${candidateFile.filename ?? "SKILL.md"}`,
              content: candidateFile.content,
            },
          ]
        : []),
    ];
    return sources.length
      ? analyzeReview(sources.length === 2 ? "compare" : "single", sources)
      : null;
  }, [originalFile, candidateFile]);
  const diff = useMemo(
    () =>
      originalFile && candidateFile
        ? ignoreWhitespace
          ? diffLines(originalFile.content, candidateFile.content, { ignoreWhitespace })
          : (report?.diff ?? null)
        : null,
    [originalFile, candidateFile, ignoreWhitespace, report],
  );
  const view = useMemo<AnalysisView>(() => {
    if (!report) return { kind: "empty" };
    const first = report.documents[0]!;
    const second = report.documents[1];
    if (originalFile && candidateFile && second && diff)
      return {
        kind: "both",
        original: first,
        candidate: second,
        diff,
        comparison: compareQualityReports(first.quality, second.quality),
      };
    return originalFile
      ? { kind: "original-only", original: first }
      : { kind: "candidate-only", candidate: first };
  }, [report, originalFile, candidateFile, diff]);
  return { original, candidate, view, report };
}
