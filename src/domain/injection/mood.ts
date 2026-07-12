import { downgradeSuspicionTier } from "./suspicion.ts";
import type { Suspicion } from "./types.ts";

// A narrow, deliberately conservative list: third-person subjects describing what a
// system/tool *will* or *can* do, rather than a directive telling the reader to do it
// now. Kept narrow so an attacker can't trivially wrap a live instruction in an
// unlisted noun phrase to earn a downgrade.
const DESCRIPTIVE_FRAME =
  /\b(?:the (?:system|assistant|skill|tool|model|agent)|it|this (?:tool|skill|script))\s+(?:will|can|may|should|would|could|is going to)\s+/iu;
const MAX_FRAME_GAP = 40;

/**
 * True when a match sits inside a third-person descriptive clause ("the tool will
 * execute...") rather than a direct, active instruction to the reader.
 */
export function isDescriptiveFraming(line: string, matchIndex: number): boolean {
  const prefix = line.slice(0, matchIndex);
  const match = DESCRIPTIVE_FRAME.exec(prefix);
  if (!match) {
    return false;
  }
  const gap = matchIndex - (match.index + match[0].length);
  return gap >= 0 && gap <= MAX_FRAME_GAP;
}

/** Drops suspicion by one tier when the match reads as descriptive rather than a live directive. */
export function downgradeIfDescriptive(base: Suspicion, descriptive: boolean): Suspicion {
  return descriptive ? downgradeSuspicionTier(base) : base;
}
