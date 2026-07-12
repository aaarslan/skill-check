import type { DiffResult } from "../domain/diff/index.ts";
import type { QualityReport } from "../domain/quality/types.ts";
import type { LoadedFile } from "../domain/shared/types.ts";
import styles from "./ComparisonOverview.module.css";

interface ComparisonOverviewProps {
  readonly originalFile: LoadedFile;
  readonly candidateFile: LoadedFile;
  readonly diff: DiffResult;
  readonly qualityOriginal: QualityReport;
  readonly qualityCandidate: QualityReport;
  readonly injectionOriginalHighCount: number;
  readonly injectionCandidateHighCount: number;
}

export function ComparisonOverview({
  originalFile,
  candidateFile,
  diff,
  qualityOriginal,
  qualityCandidate,
  injectionOriginalHighCount,
  injectionCandidateHighCount,
}: ComparisonOverviewProps) {
  return (
    <section className={styles.overview} aria-label="Comparison summary">
      <div className={styles.stat}>
        <span className={styles.statLabel}>Words</span>
        <span className={styles.statValue}>
          {originalFile.wordCount.toLocaleString()} → {candidateFile.wordCount.toLocaleString()}
        </span>
      </div>
      <div className={styles.stat}>
        <span className={styles.statLabel}>Diff</span>
        <span className={styles.statValue}>
          <span className={styles.added}>+{diff.addedCount}</span>{" "}
          <span className={styles.removed}>-{diff.removedCount}</span>
        </span>
      </div>
      <div className={styles.stat}>
        <span className={styles.statLabel}>Quality score</span>
        <span className={styles.statValue}>
          {qualityOriginal.score} → {qualityCandidate.score}
        </span>
      </div>
      <div className={styles.stat}>
        <span className={styles.statLabel}>High-suspicion injection matches</span>
        <span className={styles.statValue}>
          {injectionOriginalHighCount} → {injectionCandidateHighCount}
        </span>
      </div>
    </section>
  );
}
