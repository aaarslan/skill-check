import type { SpecFinding } from "../../domain/spec/validate.ts";
import { SeverityBadge } from "../SeverityBadge.tsx";
import styles from "../Quality/QualityFindingsList.module.css";

interface SpecPanelProps {
  readonly slotLabel: string;
  readonly findings: readonly SpecFinding[];
}

export function SpecPanel({ slotLabel, findings }: SpecPanelProps) {
  return (
    <section aria-label={`${slotLabel} spec compliance`}>
      <h3>{slotLabel}: Agent Skills spec</h3>
      {findings.length === 0 ? (
        <p className={styles.empty}>
          No spec-compliance findings. Frontmatter and layout match the checked constraints.
        </p>
      ) : (
        <ul className={styles.list}>
          {findings.map((finding) => (
            <li
              key={`${finding.ruleId}:${finding.location?.line ?? "doc"}:${finding.message}`}
              className={styles.item}
            >
              <div className={styles.itemHeader}>
                <SeverityBadge severity={finding.severity} />
                <span className={styles.category}>Spec</span>
                {finding.location && (
                  <span className={styles.line}>Line {finding.location.line}</span>
                )}
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
      )}
    </section>
  );
}
