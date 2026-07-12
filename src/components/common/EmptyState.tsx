import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  readonly title: string;
  readonly description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className={styles.empty} role="status">
      <p className={styles.title}>{title}</p>
      <p className={styles.description}>{description}</p>
    </div>
  );
}
