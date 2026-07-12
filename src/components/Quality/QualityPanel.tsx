import { useId, useMemo } from "react";
import { QUALITY_CATEGORIES } from "../../domain/quality/scoring.ts";
import type { QualityReport } from "../../domain/quality/types.ts";
import { useFindingFilters } from "../../hooks/useFindingFilters.ts";
import { FindingFilters } from "../Filters/FindingFilters.tsx";
import { SEVERITY_LABELS, SEVERITY_ORDER } from "../severityLabels.ts";
import { QUALITY_CATEGORY_LABELS } from "./labels.ts";
import { QualityFindingsList } from "./QualityFindingsList.tsx";
import { ScoreGauge } from "./ScoreGauge.tsx";
import styles from "./QualityPanel.module.css";

interface QualityPanelProps {
  readonly slotLabel: string;
  readonly report: QualityReport;
}

const SEVERITY_OPTIONS = SEVERITY_ORDER.map((value) => ({ value, label: SEVERITY_LABELS[value] }));
const CATEGORY_OPTIONS = QUALITY_CATEGORIES.map((value) => ({
  value,
  label: QUALITY_CATEGORY_LABELS[value],
}));

export function QualityPanel({ slotLabel, report }: QualityPanelProps) {
  const headingId = useId();
  const { selectedSeverities, selectedCategories, toggleSeverity, toggleCategory } =
    useFindingFilters(SEVERITY_ORDER, QUALITY_CATEGORIES);

  const filteredFindings = useMemo(
    () =>
      report.findings.filter(
        (finding) =>
          selectedSeverities.has(finding.severity) && selectedCategories.has(finding.category),
      ),
    [report.findings, selectedSeverities, selectedCategories],
  );

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <div className={styles.header}>
        <h3 id={headingId}>{slotLabel} quality</h3>
        <ScoreGauge label="Overall" score={report.score} />
      </div>

      <ul className={styles.categoryGrid}>
        {report.categoryScores.map((entry) => (
          <li key={entry.category} className={styles.categoryItem}>
            <ScoreGauge
              label={QUALITY_CATEGORY_LABELS[entry.category]}
              score={entry.score}
              compact
            />
            <span className={styles.categoryLabel}>{QUALITY_CATEGORY_LABELS[entry.category]}</span>
          </li>
        ))}
      </ul>

      <FindingFilters
        severityOptions={SEVERITY_OPTIONS}
        selectedSeverities={selectedSeverities}
        onToggleSeverity={toggleSeverity}
        categoryOptions={CATEGORY_OPTIONS}
        selectedCategories={selectedCategories}
        onToggleCategory={toggleCategory}
      />

      <QualityFindingsList findings={filteredFindings} totalCount={report.findings.length} />
    </section>
  );
}
