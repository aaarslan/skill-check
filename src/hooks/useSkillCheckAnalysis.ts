import { useMemo } from "react";
import { compareQualityReports, type QualityComparison } from "../domain/quality/compare.ts";
import { analyzeQuality } from "../domain/quality/analyze.ts";
import {
  findCrossFileLinkFindings,
  mergeAdditionalFindings,
} from "../domain/quality/crossFileLinks.ts";
import type { QualityReport } from "../domain/quality/types.ts";
import { detectInjection } from "../domain/injection/detect.ts";
import type { InjectionFinding } from "../domain/injection/types.ts";
import { diffLines } from "../domain/diff/diffLines.ts";
import type { DiffResult } from "../domain/diff/types.ts";
import type { LoadedFile } from "../domain/shared/types.ts";
import type { FileLoaderApi } from "./useFileLoader.ts";
import { useFileLoader } from "./useFileLoader.ts";

/** A single loaded file with its fully-derived analysis. */
export interface AnalyzedSlot {
  readonly file: LoadedFile;
  readonly quality: QualityReport;
  readonly injection: readonly InjectionFinding[];
}

/**
 * What the results area can show, as a discriminated union. Encoding the
 * "both files ready" invariant here (rather than re-deriving it in the view)
 * keeps the joint non-null guarantee in the layer that owns the analysis.
 */
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
}

function toCrossFileDocument(file: LoadedFile) {
  return { content: file.content, filename: file.filename };
}

/**
 * Composes the two file loaders with the pure diff/quality/injection domain
 * functions. All analysis is derived with useMemo, never stored as its own
 * state, so it can never drift out of sync with the loaded file contents.
 */
export function useSkillCheckAnalysis(ignoreWhitespace: boolean): SkillCheckAnalysis {
  const original = useFileLoader();
  const candidate = useFileLoader();

  const originalFile = original.state.status === "loaded" ? original.state.file : null;
  const candidateFile = candidate.state.status === "loaded" ? candidate.state.file : null;

  const diff = useMemo(() => {
    if (!originalFile || !candidateFile) {
      return null;
    }
    return diffLines(originalFile.content, candidateFile.content, { ignoreWhitespace });
  }, [originalFile, candidateFile, ignoreWhitespace]);

  const qualityOriginalBase = useMemo(
    () => (originalFile ? analyzeQuality(originalFile.content) : null),
    [originalFile],
  );
  const qualityCandidateBase = useMemo(
    () => (candidateFile ? analyzeQuality(candidateFile.content) : null),
    [candidateFile],
  );

  // Anchor links that explicitly target the sibling file by name can only be resolved
  // once both documents are available, so this runs at the comparison layer rather
  // than as a per-file QualityRule (which only ever sees one document at a time).
  const crossFileFindings = useMemo(() => {
    if (!originalFile || !candidateFile) {
      return null;
    }
    return {
      original: findCrossFileLinkFindings(
        toCrossFileDocument(originalFile),
        toCrossFileDocument(candidateFile),
      ),
      candidate: findCrossFileLinkFindings(
        toCrossFileDocument(candidateFile),
        toCrossFileDocument(originalFile),
      ),
    };
  }, [originalFile, candidateFile]);

  const qualityOriginal = useMemo(
    () =>
      qualityOriginalBase
        ? mergeAdditionalFindings(qualityOriginalBase, crossFileFindings?.original ?? [])
        : null,
    [qualityOriginalBase, crossFileFindings],
  );
  const qualityCandidate = useMemo(
    () =>
      qualityCandidateBase
        ? mergeAdditionalFindings(qualityCandidateBase, crossFileFindings?.candidate ?? [])
        : null,
    [qualityCandidateBase, crossFileFindings],
  );

  const comparison = useMemo(
    () =>
      qualityOriginal && qualityCandidate
        ? compareQualityReports(qualityOriginal, qualityCandidate)
        : null,
    [qualityOriginal, qualityCandidate],
  );

  const injectionOriginal = useMemo(
    () => (originalFile ? detectInjection(originalFile.content) : null),
    [originalFile],
  );
  const injectionCandidate = useMemo(
    () => (candidateFile ? detectInjection(candidateFile.content) : null),
    [candidateFile],
  );

  const originalSlot = useMemo<AnalyzedSlot | null>(
    () =>
      originalFile && qualityOriginal && injectionOriginal
        ? { file: originalFile, quality: qualityOriginal, injection: injectionOriginal }
        : null,
    [originalFile, qualityOriginal, injectionOriginal],
  );
  const candidateSlot = useMemo<AnalyzedSlot | null>(
    () =>
      candidateFile && qualityCandidate && injectionCandidate
        ? { file: candidateFile, quality: qualityCandidate, injection: injectionCandidate }
        : null,
    [candidateFile, qualityCandidate, injectionCandidate],
  );

  const view = useMemo<AnalysisView>(() => {
    if (originalSlot && candidateSlot && diff && comparison) {
      return { kind: "both", original: originalSlot, candidate: candidateSlot, diff, comparison };
    }
    if (originalSlot) {
      return { kind: "original-only", original: originalSlot };
    }
    if (candidateSlot) {
      return { kind: "candidate-only", candidate: candidateSlot };
    }
    return { kind: "empty" };
  }, [originalSlot, candidateSlot, diff, comparison]);

  return { original, candidate, view };
}
