import { useMemo } from "react";
import { evaluateCalibration } from "../domain/calibration/evaluate.ts";
import styles from "../App.module.css";

export function CalibrationPanel() {
  const result = useMemo(() => evaluateCalibration(), []);
  return (
    <section className={styles.results} aria-label="Calibration evidence">
      <details>
        <summary>Inspect calibration: {result.cases.length} labeled synthetic examples</summary>
        <p>{result.limitations}</p>
        <p>
          Corpus {result.corpusVersion} · Rules {result.ruleVersion} · Positive prediction: medium
          or high suspicion.
        </p>
        <div className={styles.tableScroll}>
          <table>
            <caption>
              False positives use negative examples as denominator; misses use positive examples.
              Each example can have multiple labels.
            </caption>
            <thead>
              <tr>
                <th>Category</th>
                <th>False positives / negatives</th>
                <th>Misses / positives</th>
              </tr>
            </thead>
            <tbody>
              {result.categories.map((category) => (
                <tr key={category.category}>
                  <th scope="row">{category.category}</th>
                  <td>
                    {category.falsePositives} / {category.negatives} (
                    {category.falsePositiveRate === null
                      ? "n/a"
                      : `${Math.round(category.falsePositiveRate * 100)}%`}
                    )
                  </td>
                  <td>
                    {category.misses} / {category.positives} (
                    {category.missRate === null ? "n/a" : `${Math.round(category.missRate * 100)}%`}
                    )
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details>
          <summary>Labels, source text, and per-example outcomes</summary>
          {result.cases.map((item) => (
            <article className={styles.reviewFinding} key={item.id}>
              <h3>
                {item.id} · {item.kind}
              </h3>
              <p>{item.rationale}</p>
              <pre style={{ whiteSpace: "pre-wrap" }}>{item.content}</pre>
              <p>
                Expected: {item.expected.join(", ") || "none"}. Predicted:{" "}
                {item.predicted.join(", ") || "none"}.
              </p>
              <p>
                Misses: {item.missed.join(", ") || "none"}. False positives:{" "}
                {item.falsePositives.join(", ") || "none"}.
              </p>
            </article>
          ))}
        </details>
      </details>
    </section>
  );
}
