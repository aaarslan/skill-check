import type { QualityCategory } from "../../domain/quality/types.ts";

export const QUALITY_CATEGORY_LABELS: Record<QualityCategory, string> = {
  purpose: "Purpose & Scope",
  actionability: "Actionability",
  consistency: "Consistency",
  structure: "Structure & Concision",
  integrity: "Integrity",
};
