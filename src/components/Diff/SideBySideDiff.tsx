import type { SideBySideRow } from "../../domain/diff/index.ts";
import { cellText } from "./cellText.ts";
import styles from "./DiffTable.module.css";

interface SideBySideDiffProps {
  readonly rows: readonly SideBySideRow[];
  readonly registerRowRef: (index: number, element: HTMLElement | null) => void;
}

export function SideBySideDiff({ rows, registerRowRef }: SideBySideDiffProps) {
  return (
    <table className={`${styles.table} ${styles.sideBySide}`}>
      <caption className="visually-hidden">Side-by-side diff</caption>
      <colgroup>
        <col className={styles.numberCol} />
        <col />
        <col className={styles.numberCol} />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Orig.</th>
          <th scope="col">Original</th>
          <th scope="col" className={styles.divider}>
            Cand.
          </th>
          <th scope="col">Candidate</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index} ref={(element) => registerRowRef(index, element)}>
            <td className={styles.lineNumber}>{row.left?.originalLineNumber ?? ""}</td>
            <td
              className={row.left ? styles[row.left.type] : styles.blank}
              data-diff-type={row.left?.type}
            >
              <code>{cellText(row.left)}</code>
            </td>
            <td className={`${styles.lineNumber} ${styles.divider}`}>
              {row.right?.candidateLineNumber ?? ""}
            </td>
            <td
              className={row.right ? styles[row.right.type] : styles.blank}
              data-diff-type={row.right?.type}
            >
              <code>{cellText(row.right)}</code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
