import { useMemo } from "react";
import { compareQualityReports, type QualityComparison } from "../domain/quality/compare.ts";
import type { Review } from "../domain/review/analyze.ts";
import { useAsyncReview } from "./useAsyncReview.ts";
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
  readonly analyzing: boolean;
  readonly error: string | null;
}

/** Revisions are independent documents; only package review resolves sibling links. */
export function useSkillCheckAnalysis(ignoreWhitespace: boolean): SkillCheckAnalysis {
  const original = useFileLoader();
  const candidate = useFileLoader();
  const loadedOriginal = original.state.status === "idle" ? null : original.state.file;
  const loadedCandidate = candidate.state.status === "idle" ? null : candidate.state.file;
  const originalFile = loadedOriginal;
  const candidateFile = loadedCandidate;
  const sources = useMemo(
    () => [
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
    ],
    [originalFile, candidateFile],
  );
  const {
    review: report,
    pending,
    error,
  } = useAsyncReview(sources.length === 2 ? "compare" : "single", sources);
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
  return { original, candidate, view, report, analyzing: pending, error };
}
