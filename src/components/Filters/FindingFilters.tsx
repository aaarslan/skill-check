import styles from "./FindingFilters.module.css";

interface CategoryOption<TCategory extends string> {
  readonly value: TCategory;
  readonly label: string;
}

interface FindingFiltersProps<TSeverity extends string, TCategory extends string> {
  readonly severityOptions: readonly { value: TSeverity; label: string }[];
  readonly selectedSeverities: ReadonlySet<TSeverity>;
  readonly onToggleSeverity: (severity: TSeverity) => void;
  readonly categoryOptions: readonly CategoryOption<TCategory>[];
  readonly selectedCategories: ReadonlySet<TCategory>;
  readonly onToggleCategory: (category: TCategory) => void;
}

/** Multi-select severity and category filters shared by the quality and injection findings lists. */
export function FindingFilters<TSeverity extends string, TCategory extends string>({
  severityOptions,
  selectedSeverities,
  onToggleSeverity,
  categoryOptions,
  selectedCategories,
  onToggleCategory,
}: FindingFiltersProps<TSeverity, TCategory>) {
  return (
    <div className={styles.filters}>
      <fieldset className={styles.group}>
        <legend>Severity</legend>
        {severityOptions.map((option) => (
          <label key={option.value} className={styles.checkbox}>
            <input
              type="checkbox"
              checked={selectedSeverities.has(option.value)}
              onChange={() => onToggleSeverity(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <fieldset className={styles.group}>
        <legend>Category</legend>
        {categoryOptions.map((option) => (
          <label key={option.value} className={styles.checkbox}>
            <input
              type="checkbox"
              checked={selectedCategories.has(option.value)}
              onChange={() => onToggleCategory(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
