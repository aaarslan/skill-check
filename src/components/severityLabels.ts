import type { Severity } from "../domain/shared/types.ts";

export const SEVERITY_LABELS: Record<Severity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

export const SEVERITY_ORDER: readonly Severity[] = ["high", "medium", "low", "info"];
