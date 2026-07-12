import type { Suspicion } from "./types.ts";

/** Drops a suspicion level by one tier (high -> medium -> low), floored at low. */
export function downgradeSuspicionTier(base: Suspicion): Suspicion {
  if (base === "high") {
    return "medium";
  }
  return "low";
}

/** Raises a suspicion level by one tier (low -> medium -> high), capped at high. */
export function upgradeSuspicionTier(base: Suspicion): Suspicion {
  if (base === "low") {
    return "medium";
  }
  return "high";
}
