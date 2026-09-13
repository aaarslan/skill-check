import { useMemo, useState } from "react";
import { analyzeReview } from "../domain/review/analyze.ts";
import { SAMPLE_PACKAGE } from "../domain/review/samples.ts";
import { usePackageLoader } from "../hooks/usePackageLoader.ts";
import { useReviewDecisions } from "../hooks/useReviewDecisions.ts";
import { ReviewWorkflow } from "./ReviewWorkflow.tsx";
import styles from "../App.module.css";

export function PackageReview() {
  const loader = usePackageLoader();
  const report = useMemo(
    () => (loader.sources.length ? analyzeReview("package", loader.sources) : null),
    [loader.sources],
  );
  const [draft, setDraft] = useState<{ path: string; content: string } | null>(null);
  const workflow = useReviewDecisions(report);
  return (
    <section className={styles.results} aria-label="Package review">
      <h2>Review a skill folder</h2>
      <p>
        Select a small folder with SKILL.md, references, and text scripts. All text is scanned;
        Markdown links are checked against this selection. Scripts are read as inert text.
      </p>
      <p className={styles.sectionDisclaimer}>
        Up to 100 files, 256 KiB and 4,000 lines per file, 2 MiB total. Binary assets and archives
        are not supported. External links are never fetched.
      </p>
      <div className={styles.workflowActions}>
        <label className={styles.secondaryAction}>
          Choose folder
          <input
            aria-label="Choose skill folder"
            type="file"
            {...{ webkitdirectory: "" }}
            multiple
            onChange={(event) => {
              setDraft(null);
              void loader.load(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
        </label>
        <button
          className={styles.secondaryAction}
          type="button"
          onClick={() => {
            setDraft(null);
            loader.replace(SAMPLE_PACKAGE);
          }}
        >
          Try sample package
        </button>
        <button
          className={styles.secondaryAction}
          type="button"
          onClick={() => {
            setDraft(null);
            loader.clear();
          }}
        >
          Clear package
        </button>
      </div>
      {loader.loading && <p role="status">Reading selected text files…</p>}
      {loader.error && <p role="alert">{loader.error}</p>}
      {report && (
        <>
          <h3>{report.documents.length} files reviewed</h3>
          {!loader.sources.some((source) => /(^|\/)SKILL\.md$/u.test(source.path)) && (
            <p role="status">No SKILL.md was selected. This review covers only the listed files.</p>
          )}
          <ul>
            {report.documents.map((document) => (
              <li key={document.file.filename}>
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={() =>
                    setDraft({ path: document.file.filename!, content: document.file.content })
                  }
                >
                  Edit {document.file.filename}
                </button>{" "}
                Quality {document.quality.score}/100 · {document.injection.length} injection signals
                ·{" "}
                {
                  document.quality.findings.filter((finding) =>
                    finding.ruleId.startsWith("package/"),
                  ).length
                }{" "}
                package link findings
              </li>
            ))}
          </ul>
          {draft && (
            <div className={styles.packageEditor}>
              <label htmlFor="package-editor">Editing {draft.path}</label>
              <textarea
                id="package-editor"
                value={draft.content}
                onChange={(event) => setDraft({ ...draft, content: event.target.value })}
                rows={14}
              />
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={() =>
                  loader.replace(
                    loader.sources.map((source) => (source.path === draft.path ? draft : source)),
                  )
                }
              >
                Apply and review package
              </button>
              <p className={styles.sectionDisclaimer}>
                Reports reflect applied content only. Unapplied edits are not included.
              </p>
            </div>
          )}
          <ReviewWorkflow review={report} workflow={workflow} />
        </>
      )}
    </section>
  );
}
