import type { AnalyzableDocument } from "../shared/markdown.ts";
import type { FindingLocation, Severity } from "../shared/types.ts";

export type QualityCategory =
  | "purpose"
  | "actionability"
  | "consistency"
  | "structure"
  | "integrity";

export interface QualityFinding {
  readonly ruleId: string;
  readonly category: QualityCategory;
  readonly severity: Severity;
  readonly message: string;
  readonly explanation: string;
  readonly suggestion: string;
  /** Absent for document-level findings that are not anchored to one line. */
  readonly location: FindingLocation | null;
}

export interface QualityRule {
  readonly id: string;
  readonly category: QualityCategory;
  readonly description: string;
  readonly evaluate: (doc: AnalyzableDocument) => QualityFinding[];
}

export interface CategoryScore {
  readonly category: QualityCategory;
  readonly score: number;
}

export interface QualityReport {
  readonly score: number;
  readonly categoryScores: readonly CategoryScore[];
  readonly findings: readonly QualityFinding[];
}
