import type { QualityFinding } from "../../domain/quality/types.ts";
import { SeverityBadge } from "../SeverityBadge.tsx";
import { QUALITY_CATEGORY_LABELS } from "./labels.ts";
import styles from "./QualityFindingsList.module.css";

interface QualityFindingsListProps {
  readonly findings: readonly QualityFinding[];
  readonly totalCount: number;
}

export function QualityFindingsList({ findings, totalCount }: QualityFindingsListProps) {
  if (totalCount === 0) {
    return (
      <p className={styles.empty}>
        No quality findings. This file passed every deterministic check.
      </p>
    );
  }
  if (findings.length === 0) {
    return <p className={styles.empty}>No findings match the current filters.</p>;
  }

  return (
    <ul className={styles.list}>
      {findings.map((finding) => (
        <li
          key={`${finding.ruleId}:${finding.location?.line ?? "doc"}:${finding.message}`}
          className={styles.item}
        >
          <div className={styles.itemHeader}>
            <SeverityBadge severity={finding.severity} />
            <span className={styles.category}>{QUALITY_CATEGORY_LABELS[finding.category]}</span>
            {finding.location && <span className={styles.line}>Line {finding.location.line}</span>}
          </div>
          <p className={styles.message}>{finding.message}</p>
          <p className={styles.explanation}>{finding.explanation}</p>
          <p className={styles.suggestion}>
            <strong>Suggestion:</strong> {finding.suggestion}
          </p>
          <p className={styles.ruleId}>
            Rule: <code>{finding.ruleId}</code>
          </p>
        </li>
      ))}
    </ul>
  );
}
