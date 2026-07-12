import type { DiffLine } from "../../domain/diff/index.ts";
import { cellText } from "./cellText.ts";
import styles from "./DiffTable.module.css";

interface UnifiedDiffProps {
  readonly lines: readonly DiffLine[];
  readonly registerRowRef: (index: number, element: HTMLElement | null) => void;
}

export function UnifiedDiff({ lines, registerRowRef }: UnifiedDiffProps) {
  return (
    <table className={styles.table}>
      <caption className="visually-hidden">Unified diff</caption>
      <thead>
        <tr>
          <th scope="col">Orig.</th>
          <th scope="col">Cand.</th>
          <th scope="col">Line</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, index) => (
          <tr
            key={index}
            ref={(element) => registerRowRef(index, element)}
            className={styles[line.type]}
            data-diff-type={line.type}
          >
            <td className={styles.lineNumber}>{line.originalLineNumber ?? ""}</td>
            <td className={styles.lineNumber}>{line.candidateLineNumber ?? ""}</td>
            <td className={styles.code}>
              <code>{cellText(line)}</code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
