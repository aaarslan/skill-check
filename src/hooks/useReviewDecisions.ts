import { useState } from "react";
import type { Review } from "../domain/review/analyze.ts";
import type { Decisions, FindingDecision } from "../domain/review/report.ts";
import type { DismissedFindingsApi } from "./useDismissedFindings.ts";

export function useReviewDecisions(review: Review | null) {
  const [state, setState] = useState<{ review: Review | null; decisions: Decisions }>({
    review,
    decisions: {},
  });
  const decisions = state.review === review ? state.decisions : {};
  const update = (id: string, decision: FindingDecision) =>
    setState((previous) => ({
      review,
      decisions: { ...(previous.review === review ? previous.decisions : {}), [id]: decision },
    }));
  const injectionDismissals = (document: Review["documents"][number]): DismissedFindingsApi => {
    const key = (id: string) =>
      `${document.file.filename}:injection:${document.injection.findIndex((finding) => finding.id === id)}`;
    return {
      isDismissed: (id) => decisions[key(id)]?.status === "dismissed",
      dismiss: (id) =>
        update(key(id), { status: "dismissed", note: decisions[key(id)]?.note ?? "" }),
      restore: (id) => update(key(id), { status: "open", note: decisions[key(id)]?.note ?? "" }),
    };
  };
  return { decisions, update, injectionDismissals };
}

export type ReviewDecisions = ReturnType<typeof useReviewDecisions>;
