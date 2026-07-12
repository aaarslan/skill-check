import { useState } from "react";
import { ComparisonOverview } from "./components/ComparisonOverview.tsx";
import { EmptyState } from "./components/common/EmptyState.tsx";
import { DiffViewer } from "./components/Diff/DiffViewer.tsx";
import { FileInputPanel } from "./components/FileInput/FileInputPanel.tsx";
import { InjectionPanel } from "./components/Injection/InjectionPanel.tsx";
import { ComparisonSummary } from "./components/Quality/ComparisonSummary.tsx";
import { QualityPanel } from "./components/Quality/QualityPanel.tsx";
import { countHighSuspicion } from "./domain/injection/detect.ts";
import { useSkillCheckAnalysis } from "./hooks/useSkillCheckAnalysis.ts";
import styles from "./App.module.css";

export function App() {
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const { original, candidate, view } = useSkillCheckAnalysis(ignoreWhitespace);

  const originalSlot = view.kind === "both" || view.kind === "original-only" ? view.original : null;
  const candidateSlot =
    view.kind === "both" || view.kind === "candidate-only" ? view.candidate : null;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>Skillcheck</h1>
        <p className={styles.tagline}>
          Compare two LLM skill Markdown files: diff, deterministic quality scoring, and
          prompt-injection pattern detection. Everything runs locally in your browser. Nothing is
          uploaded or transmitted.
        </p>
      </header>

      <aside className={styles.disclaimer} aria-label="Disclaimer">
        <strong>Heuristic tool, not a verdict.</strong> Quality scores and prompt-injection findings
        are signals to guide your own review, not proof of quality or safety. A clean result is not
        a safety clearance.
      </aside>

      <section className={styles.inputGrid} aria-label="File input">
        <FileInputPanel slotLabel="Original" loader={original} />
        <FileInputPanel slotLabel="Candidate" loader={candidate} />
      </section>

      {view.kind === "empty" && (
        <EmptyState
          title="Load two skill files to get started"
          description="Upload, drag & drop, or paste the Original and Candidate Markdown files above."
        />
      )}
      {view.kind === "original-only" && (
        <EmptyState
          title="Waiting for the Candidate file"
          description="Load a Candidate file above to see the diff, comparison, and injection findings."
        />
      )}
      {view.kind === "candidate-only" && (
        <EmptyState
          title="Waiting for the Original file"
          description="Load an Original file above to see the diff, comparison, and injection findings."
        />
      )}

      {view.kind === "both" && (
        <>
          <ComparisonOverview
            originalFile={view.original.file}
            candidateFile={view.candidate.file}
            diff={view.diff}
            qualityOriginal={view.original.quality}
            qualityCandidate={view.candidate.quality}
            injectionOriginalHighCount={countHighSuspicion(view.original.injection)}
            injectionCandidateHighCount={countHighSuspicion(view.candidate.injection)}
          />
          <DiffViewer
            diff={view.diff}
            ignoreWhitespace={ignoreWhitespace}
            onIgnoreWhitespaceChange={setIgnoreWhitespace}
          />
          <ComparisonSummary comparison={view.comparison} />
        </>
      )}

      {(originalSlot || candidateSlot) && (
        <section aria-label="Quality analysis">
          <p className={styles.sectionDisclaimer}>
            Quality scores come from transparent, deterministic rules — they are heuristic signals,
            not an objective guarantee of skill quality.
          </p>
          <div className={styles.twoCol}>
            {originalSlot && <QualityPanel slotLabel="Original" report={originalSlot.quality} />}
            {candidateSlot && <QualityPanel slotLabel="Candidate" report={candidateSlot.quality} />}
          </div>
        </section>
      )}

      {(originalSlot || candidateSlot) && (
        <section aria-label="Prompt-injection findings">
          <p className={styles.sectionDisclaimer}>
            Pattern matching cannot reliably prove or exclude prompt injection. These are heuristic
            signals to review, not a verdict.
          </p>
          <div className={styles.twoCol}>
            {originalSlot && (
              <InjectionPanel slotLabel="Original" findings={originalSlot.injection} />
            )}
            {candidateSlot && (
              <InjectionPanel slotLabel="Candidate" findings={candidateSlot.injection} />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
