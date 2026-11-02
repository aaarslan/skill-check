import styles from "../App.module.css";

export type ReviewModeSelection = "single" | "compare" | "package";

interface ModePickerProps {
  readonly mode: ReviewModeSelection;
  readonly canCreateCandidate: boolean;
  readonly onModeChange: (mode: ReviewModeSelection) => void;
  readonly onTryExample: () => void;
  readonly onCreateCandidate: () => void;
}

export function ModePicker({
  mode,
  canCreateCandidate,
  onModeChange,
  onTryExample,
  onCreateCandidate,
}: ModePickerProps) {
  return (
    <section className={styles.results} aria-label="Choose review mode">
      <h2>Start with a file or try an example</h2>
      <div className={styles.workflowActions}>
        {(["single", "compare", "package"] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={styles.secondaryAction}
            aria-pressed={mode === option}
            onClick={() => onModeChange(option)}
          >
            {option === "single"
              ? "Review one file"
              : option === "compare"
                ? "Compare revisions"
                : "Review folder"}
          </button>
        ))}
        {mode !== "package" && (
          <button type="button" className={styles.secondaryAction} onClick={onTryExample}>
            Try review example
          </button>
        )}
        {mode === "single" && canCreateCandidate && (
          <button type="button" className={styles.secondaryAction} onClick={onCreateCandidate}>
            Create editable candidate
          </button>
        )}
      </div>
      <p className={styles.sectionDisclaimer}>
        The synthetic example includes an instruction override. Compare revisions to inspect a
        manually revised version; score changes do not establish better agent performance.
      </p>
    </section>
  );
}
