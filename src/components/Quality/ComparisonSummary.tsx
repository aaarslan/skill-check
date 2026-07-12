import type { QualityComparison } from "../../domain/quality/compare.ts";
import { QUALITY_CATEGORY_LABELS } from "./labels.ts";
import styles from "./ComparisonSummary.module.css";

interface ComparisonSummaryProps {
  readonly comparison: QualityComparison;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export function ComparisonSummary({ comparison }: ComparisonSummaryProps) {
  const improved = comparison.ruleComparisons.filter((entry) => entry.verdict === "improved");
  const regressed = comparison.ruleComparisons.filter((entry) => entry.verdict === "regressed");
  const direction = comparison.scoreDelta > 0 ? "up" : comparison.scoreDelta < 0 ? "down" : "flat";

  return (
    <section className={styles.summary} aria-label="Candidate versus original comparison">
      <div className={styles.headline}>
        <h3>Candidate vs. original</h3>
        <span className={styles.scoreDelta} data-direction={direction}>
          Overall score {signed(comparison.scoreDelta)}
        </span>
      </div>

      <ul className={styles.categoryDeltas}>
        {comparison.categoryDeltas.map((entry) => (
          <li key={entry.category}>
            <span className={styles.categoryName}>{QUALITY_CATEGORY_LABELS[entry.category]}</span>
            <span>
              {entry.original} → {entry.candidate}
            </span>
            <span
              className={styles.delta}
              data-direction={entry.delta > 0 ? "up" : entry.delta < 0 ? "down" : "flat"}
            >
              {signed(entry.delta)}
            </span>
          </li>
        ))}
      </ul>

      {improved.length === 0 && regressed.length === 0 ? (
        <p className={styles.noChange}>No rule-level differences between the two files.</p>
      ) : (
        <div className={styles.ruleLists}>
          <div>
            <h4 className={styles.improvedHeading}>Improved ({improved.length})</h4>
            <ul>
              {improved.map((entry) => (
                <li key={entry.ruleId}>
                  <code>{entry.ruleId}</code> ({entry.originalCount} → {entry.candidateCount})
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className={styles.regressedHeading}>Regressed ({regressed.length})</h4>
            <ul>
              {regressed.map((entry) => (
                <li key={entry.ruleId}>
                  <code>{entry.ruleId}</code> ({entry.originalCount} → {entry.candidateCount})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
