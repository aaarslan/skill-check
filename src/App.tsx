import { BookOpenText, ShieldCheck, Warning, X } from "@phosphor-icons/react";
import { Suspense, lazy, useState } from "react";
import { PanelErrorBoundary } from "./components/common/PanelErrorBoundary.tsx";
import { FileInputPanel } from "./components/FileInput/FileInputPanel.tsx";
import { ModePicker, type ReviewModeSelection } from "./components/ModePicker.tsx";
import { ResultsSection } from "./components/ResultsSection.tsx";
import { ReviewWorkflow } from "./components/ReviewWorkflow.tsx";
import { SAMPLE_CANDIDATE, SAMPLE_ORIGINAL } from "./domain/review/samples.ts";
import { useReviewDecisions } from "./hooks/useReviewDecisions.ts";
import { useSkillCheckAnalysis } from "./hooks/useSkillCheckAnalysis.ts";
import styles from "./App.module.css";

const PackageReview = lazy(() =>
  import("./components/PackageReview.tsx").then((m) => ({ default: m.PackageReview })),
);
const CalibrationPanel = lazy(() =>
  import("./components/CalibrationPanel.tsx").then((m) => ({ default: m.CalibrationPanel })),
);

export function App() {
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(() => {
    try {
      return window.localStorage.getItem("skillcheck:disclaimer-dismissed") !== "1";
    } catch {
      return true;
    }
  });
  const [mode, setMode] = useState<ReviewModeSelection>("single");
  const { original, candidate, view, report, analyzing, error } =
    useSkillCheckAnalysis(ignoreWhitespace);
  const workflow = useReviewDecisions(report);
  const originalSlot = view.kind === "both" || view.kind === "original-only" ? view.original : null;

  return (
    <main className={styles.app}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <ShieldCheck size={38} weight="regular" aria-hidden="true" />
          <h1>Skillcheck</h1>
        </div>
        <p className={styles.tagline}>
          Review a skill file, compare revisions, or inspect a local folder with quality scoring and
          prompt-injection pattern detection — all in your browser.
        </p>
        <nav className={styles.headerActions} aria-label="Application actions">
          <a
            className={styles.secondaryAction}
            href="https://github.com/aaarslan/skill-check#readme"
            target="_blank"
            rel="noreferrer"
          >
            <BookOpenText size={23} aria-hidden="true" />
            Docs
          </a>
        </nav>
      </header>

      {showDisclaimer && (
        <aside className={styles.disclaimer} aria-label="Disclaimer">
          <Warning size={34} weight="regular" aria-hidden="true" />
          <div>
            <strong>Heuristic tool, not a verdict.</strong>
            <p>
              Quality scores and prompt-injection findings are signals to guide your own review, not
              proof of quality or safety. A clean result is not a safety clearance.
            </p>
          </div>
          <button
            className={styles.dismissButton}
            type="button"
            aria-label="Dismiss disclaimer"
            onClick={() => {
              setShowDisclaimer(false);
              try {
                window.localStorage.setItem("skillcheck:disclaimer-dismissed", "1");
              } catch {}
            }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </aside>
      )}

      <ModePicker
        mode={mode}
        canCreateCandidate={originalSlot !== null}
        onModeChange={(option) => {
          setMode(option);
          if (option === "single") candidate.clear();
        }}
        onTryExample={() => {
          original.loadFromText(SAMPLE_ORIGINAL);
          if (mode === "compare") candidate.loadFromText(SAMPLE_CANDIDATE);
        }}
        onCreateCandidate={() => {
          if (!originalSlot) return;
          candidate.loadFromText(originalSlot.file.content);
          setMode("compare");
        }}
      />
      {mode === "package" ? (
        <PanelErrorBoundary label="Folder review">
          <Suspense fallback={<p role="status">Loading folder review…</p>}>
            <PackageReview />
          </Suspense>
        </PanelErrorBoundary>
      ) : (
        <>
          <section
            className={mode === "single" ? styles.singleInput : styles.inputGrid}
            aria-label="File input"
          >
            <FileInputPanel slotLabel="Original" slotKey="original" loader={original} />
            {mode === "compare" && (
              <FileInputPanel slotLabel="Candidate" slotKey="candidate" loader={candidate} />
            )}
          </section>

          <ResultsSection
            view={view}
            workflow={workflow}
            ignoreWhitespace={ignoreWhitespace}
            onIgnoreWhitespaceChange={setIgnoreWhitespace}
            analyzing={analyzing}
          />
          {error && <p role="alert">{error}</p>}
          {report && <ReviewWorkflow review={report} workflow={workflow} />}
        </>
      )}
      <PanelErrorBoundary label="Calibration">
        <Suspense fallback={null}>
          <CalibrationPanel />
        </Suspense>
      </PanelErrorBoundary>
    </main>
  );
}
