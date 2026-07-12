import type { QualityRule } from "../types.ts";
import { actionabilityRules } from "./actionability.ts";
import { consistencyRules } from "./consistency.ts";
import { integrityRules } from "./integrity.ts";
import { purposeRules } from "./purpose.ts";
import { structureRules } from "./structure.ts";

export const allQualityRules: readonly QualityRule[] = [
  ...purposeRules,
  ...actionabilityRules,
  ...consistencyRules,
  ...structureRules,
  ...integrityRules,
];
