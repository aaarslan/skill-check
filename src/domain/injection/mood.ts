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
  // A frame can only qualify when it ends within MAX_FRAME_GAP of the match,
  // and frames are short, so only the trailing window of the prefix can
  // contain one. Searching that window keeps long lines linear instead of
  // rescanning (and copying) the whole prefix per match. Any frame ending in
  // the window qualifies, not only the first frame in the full prefix.
  const windowStart = Math.max(0, matchIndex - (MAX_FRAME_GAP + 80));
  const window = line.slice(windowStart, matchIndex);
  const frames = new RegExp(DESCRIPTIVE_FRAME.source, "giu");
  for (const match of window.matchAll(frames)) {
    const frameEnd = windowStart + (match.index ?? 0) + match[0].length;
    const gap = matchIndex - frameEnd;
    if (gap >= 0 && gap <= MAX_FRAME_GAP) {
      return true;
    }
  }
  return false;
}

/** Drops suspicion by one tier when the match reads as descriptive rather than a live directive. */
export function downgradeIfDescriptive(base: Suspicion, descriptive: boolean): Suspicion {
  return descriptive ? downgradeSuspicionTier(base) : base;
}
