/** Which of the two compared files a value belongs to. */
export type FileSlot = "original" | "candidate";

/** Severity scale shared by quality findings and injection suspicion levels. */
export type Severity = "info" | "low" | "medium" | "high";

/** A single point (or short span) in a document that a finding is anchored to. */
export interface FindingLocation {
  /** 1-indexed line number within the analyzed document. */
  readonly line: number;
  /** The exact substring that triggered the finding, for display as evidence. */
  readonly excerpt: string;
}

/** A markdown skill file loaded into the browser, never persisted or transmitted. */
export interface LoadedFile {
  readonly filename: string | null;
  readonly content: string;
  readonly sizeBytes: number;
  readonly wordCount: number;
  readonly lineCount: number;
}
