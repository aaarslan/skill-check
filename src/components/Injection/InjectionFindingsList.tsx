import type { InjectionFinding } from "../../domain/injection/types.ts";
import type { DismissedFindingsApi } from "../../hooks/useDismissedFindings.ts";
import { SeverityBadge } from "../SeverityBadge.tsx";
import { INJECTION_CATEGORY_LABELS } from "./labels.ts";
import styles from "./InjectionFindingsList.module.css";

interface InjectionFindingsListProps {
  readonly findings: readonly InjectionFinding[];
  readonly totalCount: number;
  readonly dismissed: DismissedFindingsApi;
}

export function InjectionFindingsList({
  findings,
  totalCount,
  dismissed,
}: InjectionFindingsListProps) {
  if (totalCount === 0) {
    return (
      <p className={styles.empty}>
        No pattern matches found. This does not prove the content is safe.
      </p>
    );
  }
  if (findings.length === 0) {
    return <p className={styles.empty}>No findings match the current filters.</p>;
  }

  return (
    <ul className={styles.list}>
      {findings.map((finding) => {
        const isDismissed = dismissed.isDismissed(finding.id);
        return (
          <li key={finding.id} className={styles.item} data-dismissed={isDismissed}>
            <div className={styles.itemHeader}>
              <SeverityBadge severity={finding.suspicion} />
              <span className={styles.category}>{INJECTION_CATEGORY_LABELS[finding.category]}</span>
              <span className={styles.line}>Line {finding.location.line}</span>
              {finding.isQuotedExample && (
                <span className={styles.quotedTag}>Likely quoted example</span>
              )}
            </div>
            <p className={styles.matchedText}>
              <code>{finding.matchedText}</code>
            </p>
            <p className={styles.rationale}>{finding.rationale}</p>
            <p className={styles.ruleId}>
              Rule: <code>{finding.ruleId}</code>
            </p>
            <button
              type="button"
              className={styles.dismissButton}
              onClick={() =>
                isDismissed ? dismissed.restore(finding.id) : dismissed.dismiss(finding.id)
              }
            >
              {isDismissed ? "Restore" : "Dismiss as false positive"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
