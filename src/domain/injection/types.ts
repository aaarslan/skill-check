import type { AnalyzableDocument } from "../shared/markdown.ts";
import type { FindingLocation } from "../shared/types.ts";

export type InjectionCategory =
  | "instruction-override"
  | "impersonation"
  | "secret-exfiltration"
  | "data-exfiltration"
  | "system-command"
  | "safety-disable"
  | "scope-violation"
  | "encoded-payload"
  | "fake-delimiter"
  | "hidden-content";

export type Suspicion = "low" | "medium" | "high";

export interface InjectionFinding {
  /** Stable within one analysis run: `${ruleId}:${line}:${matchOffset}`. */
  readonly id: string;
  readonly ruleId: string;
  readonly category: InjectionCategory;
  readonly suspicion: Suspicion;
  readonly matchedText: string;
  readonly location: FindingLocation;
  readonly rationale: string;
  /** True when the match sits in a code block, blockquote, inline code span, or near "example"-style cues. */
  readonly isQuotedExample: boolean;
}

export interface InjectionRule {
  readonly id: string;
  readonly category: InjectionCategory;
  readonly description: string;
  readonly evaluate: (doc: AnalyzableDocument) => InjectionFinding[];
}
