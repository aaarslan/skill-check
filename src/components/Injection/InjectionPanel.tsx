import { useId, useMemo } from "react";
import { countHighSuspicion } from "../../domain/injection/detect.ts";
import { INJECTION_CATEGORIES, SUSPICION_ORDER } from "../../domain/injection/taxonomy.ts";
import type { InjectionFinding } from "../../domain/injection/types.ts";
import { useDismissedFindings } from "../../hooks/useDismissedFindings.ts";
import { useFindingFilters } from "../../hooks/useFindingFilters.ts";
import { FindingFilters } from "../Filters/FindingFilters.tsx";
import { SEVERITY_LABELS } from "../severityLabels.ts";
import { InjectionFindingsList } from "./InjectionFindingsList.tsx";
import { INJECTION_CATEGORY_LABELS } from "./labels.ts";
import styles from "./InjectionPanel.module.css";

interface InjectionPanelProps {
  readonly slotLabel: string;
  readonly findings: readonly InjectionFinding[];
}

const SUSPICION_OPTIONS = SUSPICION_ORDER.map((value) => ({
  value,
  label: SEVERITY_LABELS[value],
}));
const CATEGORY_OPTIONS = INJECTION_CATEGORIES.map((value) => ({
  value,
  label: INJECTION_CATEGORY_LABELS[value],
}));

export function InjectionPanel({ slotLabel, findings }: InjectionPanelProps) {
  const headingId = useId();
  const dismissed = useDismissedFindings();
  const {
    selectedSeverities: selectedSuspicions,
    selectedCategories,
    toggleSeverity: toggleSuspicion,
    toggleCategory,
  } = useFindingFilters(SUSPICION_ORDER, INJECTION_CATEGORIES);

  const filteredFindings = useMemo(
    () =>
      findings.filter(
        (finding) =>
          selectedSuspicions.has(finding.suspicion) && selectedCategories.has(finding.category),
      ),
    [findings, selectedSuspicions, selectedCategories],
  );

  const highCount = countHighSuspicion(findings);

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <div className={styles.header}>
        <h3 id={headingId}>{slotLabel} prompt-injection findings</h3>
        <span className={styles.countBadge} data-alert={highCount > 0}>
          {findings.length} match{findings.length === 1 ? "" : "es"}
        </span>
      </div>
      <FindingFilters
        severityOptions={SUSPICION_OPTIONS}
        selectedSeverities={selectedSuspicions}
        onToggleSeverity={toggleSuspicion}
        categoryOptions={CATEGORY_OPTIONS}
        selectedCategories={selectedCategories}
        onToggleCategory={toggleCategory}
      />

      <InjectionFindingsList
        findings={filteredFindings}
        totalCount={findings.length}
        dismissed={dismissed}
      />
    </section>
  );
}
