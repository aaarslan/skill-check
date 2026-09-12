import type { ReviewDecisions } from "../hooks/useReviewDecisions.ts";
import type { Review } from "../domain/review/analyze.ts";
import {
  exportReview,
  markdownReport,
  reviewFindings,
  type FindingDecision,
} from "../domain/review/report.ts";
import styles from "../App.module.css";

function download(text: string, extension: "json" | "md") {
  const url = URL.createObjectURL(
    new Blob([text], { type: extension === "json" ? "application/json" : "text/markdown" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `skillcheck-review.${extension}`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReviewWorkflow({
  review,
  workflow,
}: {
  readonly review: Review;
  readonly workflow: ReviewDecisions;
}) {
  const { decisions, update } = workflow;
  const findings = reviewFindings(review);
  return (
    <section className={styles.results} aria-label="Review workflow">
      <h2>Review findings and keep a record</h2>
      <p>
        Edit the source above and apply changes to analyze again. In compare mode, keep the original
        and edit the candidate. Decisions reset when the analyzed source changes.
      </p>
      <div className={styles.workflowActions}>
        <button
          className={styles.secondaryAction}
          type="button"
          onClick={() => download(JSON.stringify(exportReview(review, decisions), null, 2), "json")}
        >
          Export JSON report
        </button>
        <button
          className={styles.secondaryAction}
          type="button"
          onClick={() => download(markdownReport(review, decisions), "md")}
        >
          Export Markdown report
        </button>
      </div>
      <p className={styles.sectionDisclaimer}>
        Rules {review.ruleVersion} · Report {review.schemaVersion}. JSON includes source text;
        Markdown includes findings and notes. Exports stay on your device until you share them.
        Decisions do not change scores.
      </p>
      <details>
        <summary>{findings.length} findings to review</summary>
        {findings.map((finding) => {
          const decision = decisions[finding.id] ?? { status: "open", note: "" };
          return (
            <article className={styles.reviewFinding} key={finding.id}>
              <h3>
                {finding.path}
                {finding.line ? `:${finding.line}` : ""} · {finding.level}
              </h3>
              <p>{finding.message}</p>
              <p>{finding.suggestion}</p>
              <label>
                Decision{" "}
                <select
                  aria-label={`Decision for ${finding.id}`}
                  value={decision.status}
                  onChange={(event) =>
                    update(finding.id, {
                      ...decision,
                      status: event.target.value as FindingDecision["status"],
                    })
                  }
                >
                  <option value="open">Open</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="dismissed">Dismissed with context</option>
                </select>
              </label>
              <label>
                Review note{" "}
                <textarea
                  aria-label={`Note for ${finding.id}`}
                  maxLength={4000}
                  value={decision.note}
                  onChange={(event) =>
                    update(finding.id, { ...decision, note: event.target.value })
                  }
                  rows={2}
                />
              </label>
            </article>
          );
        })}
        {!findings.length && <p>No findings. This is not a safety clearance.</p>}
      </details>
    </section>
  );
}
