import type { Severity } from "../domain/shared/types.ts";
import { SEVERITY_LABELS } from "./severityLabels.ts";
import styles from "./SeverityBadge.module.css";

interface SeverityBadgeProps {
  readonly severity: Severity;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span className={styles.badge} data-severity={severity}>
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
