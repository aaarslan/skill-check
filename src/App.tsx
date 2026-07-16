import {
  BookOpenText,
  ChartBar,
  Hash,
  ListBullets,
  Shield,
  ShieldCheck,
  Warning,
  X,
} from "@phosphor-icons/react";
import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { EmptyState } from "./components/common/EmptyState.tsx";
import { DiffViewer } from "./components/Diff/DiffViewer.tsx";
import { FileInputPanel } from "./components/FileInput/FileInputPanel.tsx";
import { InjectionPanel } from "./components/Injection/InjectionPanel.tsx";
import { ComparisonSummary } from "./components/Quality/ComparisonSummary.tsx";
import { QualityPanel } from "./components/Quality/QualityPanel.tsx";
import { countHighSuspicion } from "./domain/injection/detect.ts";
import { useSkillCheckAnalysis } from "./hooks/useSkillCheckAnalysis.ts";
import styles from "./App.module.css";

type ResultTab = "overview" | "diff" | "quality" | "injection";

interface MetricProps {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
}

function Metric({ icon, label, value }: MetricProps) {
  return (
    <div className={styles.metric} aria-label={`${label}: ${value}`}>
      <span className={styles.metricIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.metricLabel}>{label}</span>
      <strong className={styles.metricValue}>{value}</strong>
    </div>
  );
}

export function App() {
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [activeTab, setActiveTab] = useState<ResultTab>("overview");
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const { original, candidate, view } = useSkillCheckAnalysis(ignoreWhitespace);

  const originalSlot = view.kind === "both" || view.kind === "original-only" ? view.original : null;
  const candidateSlot =
    view.kind === "both" || view.kind === "candidate-only" ? view.candidate : null;
  const bothLoaded = view.kind === "both";
  const singleSlot = originalSlot ?? candidateSlot;

  const score = bothLoaded
    ? `${view.original.quality.score} → ${view.candidate.quality.score}`
    : singleSlot
      ? singleSlot.quality.score.toString()
      : "—";
  const highRiskCount = bothLoaded
    ? countHighSuspicion(view.original.injection) + countHighSuspicion(view.candidate.injection)
    : singleSlot
      ? countHighSuspicion(singleSlot.injection)
      : null;
  const risk = highRiskCount === null ? "—" : highRiskCount > 0 ? `${highRiskCount} high` : "Low";
  const changedSections = bothLoaded ? view.diff.addedCount + view.diff.removedCount : null;
  const totalTokens = bothLoaded
    ? Math.ceil((view.original.file.content.length + view.candidate.file.content.length) / 4)
    : singleSlot
      ? Math.ceil(singleSlot.file.content.length / 4)
      : null;

  useEffect(() => {
    if (view.kind === "original-only" || view.kind === "candidate-only") {
      setActiveTab("quality");
    } else {
      setActiveTab("overview");
    }
  }, [view.kind]);

  const waitingState =
    view.kind === "original-only"
      ? {
          title: "Waiting for the Candidate file",
          description:
            "The Original quality score is ready. Load a Candidate file to compare the two.",
        }
      : view.kind === "candidate-only"
        ? {
            title: "Waiting for the Original file",
            description:
              "The Candidate quality score is ready. Load an Original file to compare the two.",
          }
        : {
            title: "Load a skill file to get started",
            description:
              "Analyze one Markdown file on its own, or load both files for a comparison.",
          };

  const tabs: readonly { id: ResultTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "diff", label: "Diff" },
    { id: "quality", label: "Quality score" },
    { id: "injection", label: "Prompt injection" },
  ];

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    if (nextTab) {
      setActiveTab(nextTab.id);
      document.getElementById(`${nextTab.id}-tab`)?.focus();
    }
  };

  return (
    <main className={styles.app}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <ShieldCheck size={38} weight="regular" aria-hidden="true" />
          <h1>Skillcheck</h1>
        </div>
        <p className={styles.tagline}>
          Analyze one LLM skill Markdown file or compare two with deterministic quality scoring and
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
            onClick={() => setShowDisclaimer(false)}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </aside>
      )}

      <section className={styles.inputGrid} aria-label="File input">
        <FileInputPanel slotLabel="Original" slotKey="original" loader={original} />
        <FileInputPanel slotLabel="Candidate" slotKey="candidate" loader={candidate} />
      </section>

      <section id="results" className={styles.results} aria-label="Analysis results">
        <div className={styles.metricGrid}>
          <Metric icon={<ChartBar size={24} />} label="Quality score" value={score} />
          <Metric icon={<Shield size={24} />} label="Risk" value={risk} />
          <Metric
            icon={<ListBullets size={24} />}
            label="Changed lines"
            value={changedSections === null ? "—" : changedSections.toLocaleString()}
          />
          <Metric
            icon={<Hash size={24} />}
            label="Est. total tokens"
            value={totalTokens === null ? "—" : totalTokens.toLocaleString()}
          />
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Analysis sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`${tab.id}-tab`}
              className={styles.tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${tab.id}-panel`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={handleTabKeyDown}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          id={`${activeTab}-panel`}
          className={styles.tabPanel}
          role="tabpanel"
          aria-labelledby={`${activeTab}-tab`}
        >
          {!bothLoaded && activeTab !== "quality" && activeTab !== "injection" && (
            <EmptyState title={waitingState.title} description={waitingState.description} />
          )}

          {bothLoaded && activeTab === "overview" && (
            <ComparisonSummary comparison={view.comparison} />
          )}

          {bothLoaded && activeTab === "diff" && (
            <DiffViewer
              diff={view.diff}
              ignoreWhitespace={ignoreWhitespace}
              onIgnoreWhitespaceChange={setIgnoreWhitespace}
            />
          )}

          {activeTab === "quality" && (
            <div className={styles.analysisSection}>
              {originalSlot || candidateSlot ? (
                <>
                  <p className={styles.sectionDisclaimer}>
                    Deterministic quality rules provide review signals, not an objective guarantee.
                  </p>
                  <div className={styles.twoCol}>
                    {originalSlot && (
                      <QualityPanel slotLabel="Original" report={originalSlot.quality} />
                    )}
                    {candidateSlot && (
                      <QualityPanel slotLabel="Candidate" report={candidateSlot.quality} />
                    )}
                  </div>
                </>
              ) : (
                <EmptyState title={waitingState.title} description={waitingState.description} />
              )}
            </div>
          )}

          {activeTab === "injection" && (
            <div className={styles.analysisSection}>
              {originalSlot || candidateSlot ? (
                <>
                  <p className={styles.sectionDisclaimer}>
                    Pattern matches are heuristic signals to review, not a safety verdict.
                  </p>
                  <div className={styles.twoCol}>
                    {originalSlot && (
                      <InjectionPanel slotLabel="Original" findings={originalSlot.injection} />
                    )}
                    {candidateSlot && (
                      <InjectionPanel slotLabel="Candidate" findings={candidateSlot.injection} />
                    )}
                  </div>
                </>
              ) : (
                <EmptyState title={waitingState.title} description={waitingState.description} />
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
