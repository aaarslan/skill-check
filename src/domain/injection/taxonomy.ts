import type { InjectionCategory, Suspicion } from "./types.ts";

/**
 * Suspicion tiers in descending order, the single source of truth for iterating
 * or offering them (e.g. filter controls). Mirrors SEVERITY_ORDER on the quality side.
 */
export const SUSPICION_ORDER: readonly Suspicion[] = ["high", "medium", "low"];

/**
 * Every injection category, in display order. Kept exhaustive over InjectionCategory
 * so UI enumerations don't rely on object key order or unchecked casts; adding a
 * category to the union without listing it here is a type error at the use sites
 * that annotate against `readonly InjectionCategory[]`.
 */
export const INJECTION_CATEGORIES: readonly InjectionCategory[] = [
  "instruction-override",
  "impersonation",
  "secret-exfiltration",
  "data-exfiltration",
  "system-command",
  "safety-disable",
  "scope-violation",
  "encoded-payload",
  "fake-delimiter",
  "hidden-content",
];
