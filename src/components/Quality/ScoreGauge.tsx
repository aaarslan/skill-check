import styles from "./ScoreGauge.module.css";

interface ScoreGaugeProps {
  readonly label: string;
  readonly score: number;
  readonly compact?: boolean;
}

function bandFor(score: number): "good" | "fair" | "poor" {
  if (score >= 80) {
    return "good";
  }
  if (score >= 50) {
    return "fair";
  }
  return "poor";
}

export function ScoreGauge({ label, score, compact = false }: ScoreGaugeProps) {
  const band = bandFor(score);
  return (
    <div
      className={compact ? styles.compact : styles.gauge}
      data-band={band}
      role="img"
      aria-label={`${label}: score ${score} of 100 (${band})`}
    >
      <span className={styles.score}>{score}</span>
      {!compact && <span className={styles.label}>{label}</span>}
    </div>
  );
}
