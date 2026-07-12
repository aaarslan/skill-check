import { useCallback, useState } from "react";

export interface DismissedFindingsApi {
  readonly isDismissed: (id: string) => boolean;
  readonly dismiss: (id: string) => void;
  readonly restore: (id: string) => void;
}

/** Tracks which finding ids the user has marked as false positives, keyed by finding id. */
export function useDismissedFindings(): DismissedFindingsApi {
  const [dismissedIds, setDismissedIds] = useState<ReadonlySet<string>>(new Set());

  const dismiss = useCallback((id: string) => {
    setDismissedIds((current) => new Set(current).add(id));
  }, []);

  const restore = useCallback((id: string) => {
    setDismissedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const isDismissed = useCallback((id: string) => dismissedIds.has(id), [dismissedIds]);

  return { isDismissed, dismiss, restore };
}
