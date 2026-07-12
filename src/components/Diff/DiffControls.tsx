import styles from "./DiffControls.module.css";

export type DiffViewMode = "side-by-side" | "unified";

interface DiffControlsProps {
  readonly viewMode: DiffViewMode;
  readonly onViewModeChange: (mode: DiffViewMode) => void;
  readonly ignoreWhitespace: boolean;
  readonly onIgnoreWhitespaceChange: (value: boolean) => void;
  readonly addedCount: number;
  readonly removedCount: number;
  readonly currentChangeIndex: number;
  readonly totalChanges: number;
  readonly onPrevChange: () => void;
  readonly onNextChange: () => void;
}

export function DiffControls({
  viewMode,
  onViewModeChange,
  ignoreWhitespace,
  onIgnoreWhitespaceChange,
  addedCount,
  removedCount,
  currentChangeIndex,
  totalChanges,
  onPrevChange,
  onNextChange,
}: DiffControlsProps) {
  return (
    <div className={styles.controls}>
      <div className={styles.group} role="group" aria-label="Diff view mode">
        <button
          type="button"
          aria-pressed={viewMode === "side-by-side"}
          className={styles.toggleButton}
          onClick={() => onViewModeChange("side-by-side")}
        >
          Side by side
        </button>
        <button
          type="button"
          aria-pressed={viewMode === "unified"}
          className={styles.toggleButton}
          onClick={() => onViewModeChange("unified")}
        >
          Unified
        </button>
      </div>

      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={ignoreWhitespace}
          onChange={(event) => onIgnoreWhitespaceChange(event.target.checked)}
        />
        Ignore whitespace
      </label>

      <div className={styles.counts}>
        <span className={styles.added}>+{addedCount}</span>
        <span className={styles.removed}>-{removedCount}</span>
      </div>

      <div className={styles.nav}>
        <button
          type="button"
          onClick={onPrevChange}
          disabled={totalChanges === 0}
          aria-label="Previous change"
        >
          Prev
        </button>
        <span aria-live="polite">
          {totalChanges === 0
            ? "No changes"
            : currentChangeIndex < 0
              ? `${totalChanges} change${totalChanges === 1 ? "" : "s"}`
              : `Change ${currentChangeIndex + 1} of ${totalChanges}`}
        </span>
        <button
          type="button"
          onClick={onNextChange}
          disabled={totalChanges === 0}
          aria-label="Next change"
        >
          Next
        </button>
      </div>
    </div>
  );
}
