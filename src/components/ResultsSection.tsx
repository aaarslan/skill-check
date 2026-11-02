import { ChartBar, Hash, ListBullets, Shield } from "@phosphor-icons/react";
import { Suspense, lazy, useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { countHighSuspicion } from "../domain/injection/detect.ts";
import type { AnalysisView } from "../hooks/useSkillCheckAnalysis.ts";
import type { ReviewDecisions } from "../hooks/useReviewDecisions.ts";
import { EmptyState } from "./common/EmptyState.tsx";
import { InjectionPanel } from "./Injection/InjectionPanel.tsx";
import { ComparisonSummary } from "./Quality/ComparisonSummary.tsx";
import { QualityPanel } from "./Quality/QualityPanel.tsx";
import { SpecPanel } from "./Spec/SpecPanel.tsx";
import styles from "../App.module.css";

const DiffViewer = lazy(() =>
  import("./Diff/DiffViewer.tsx").then((m) => ({ default: m.DiffViewer })),
);

type ResultTab = "overview" | "diff" | "quality" | "injection" | "spec";

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

interface ResultsSectionProps {
  readonly view: AnalysisView;
  readonly workflow: ReviewDecisions;
  readonly ignoreWhitespace: boolean;
  readonly onIgnoreWhitespaceChange: (value: boolean) => void;
}

export function ResultsSection({
  view,
  workflow,
  ignoreWhitespace,
  onIgnoreWhitespaceChange: setIgnoreWhitespace,
}: ResultsSectionProps) {
  const [activeTab, setActiveTab] = useState<ResultTab>("overview");
  const originalSlot = view.kind === "both" || view.kind === "original-only" ? view.original : null;
  const candidateSlot =
    view.kind === "both" || view.kind === "candidate-only" ? view.candidate : null;
  const bothLoaded = view.kind === "both";
  const singleSlot = originalSlot ?? candidateSlot;

  const score = bothLoaded
    ? `${view.original.quality.score} \u2192 ${view.candidate.quality.score}`
    : singleSlot
      ? singleSlot.quality.score.toString()
      : "\u2014";
  const highRiskCount = bothLoaded
    ? countHighSuspicion(view.original.injection) + countHighSuspicion(view.candidate.injection)
    : singleSlot
      ? countHighSuspicion(singleSlot.injection)
      : null;
  const risk =
    highRiskCount === null ? "\u2014" : highRiskCount > 0 ? `${highRiskCount} high` : "Low";
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
    { id: "spec", label: "Spec compliance" },
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
        {!bothLoaded &&
          activeTab !== "quality" &&
          activeTab !== "injection" &&
          activeTab !== "spec" && (
            <EmptyState title={waitingState.title} description={waitingState.description} />
          )}

        {bothLoaded && activeTab === "overview" && (
          <ComparisonSummary comparison={view.comparison} />
        )}

        {bothLoaded && activeTab === "diff" && (
          <Suspense fallback={<p role="status">Loading diff…</p>}>
            <DiffViewer
              diff={view.diff}
              ignoreWhitespace={ignoreWhitespace}
              onIgnoreWhitespaceChange={setIgnoreWhitespace}
            />
          </Suspense>
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
                    <InjectionPanel
                      slotLabel="Original"
                      findings={originalSlot.injection}
                      dismissed={workflow.injectionDismissals(originalSlot)}
                    />
                  )}
                  {candidateSlot && (
                    <InjectionPanel
                      slotLabel="Candidate"
                      findings={candidateSlot.injection}
                      dismissed={workflow.injectionDismissals(candidateSlot)}
                    />
                  )}
                </div>
              </>
            ) : (
              <EmptyState title={waitingState.title} description={waitingState.description} />
            )}
          </div>
        )}
        {activeTab === "spec" && (
          <div className={styles.analysisSection}>
            {originalSlot || candidateSlot ? (
              <>
                <p className={styles.sectionDisclaimer}>
                  Checked against the Agent Skills specification. Loaders may reject non-compliant
                  skills.
                </p>
                <div className={styles.twoCol}>
                  {originalSlot && <SpecPanel slotLabel="Original" findings={originalSlot.spec} />}
                  {candidateSlot && (
                    <SpecPanel slotLabel="Candidate" findings={candidateSlot.spec} />
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
  );
}
