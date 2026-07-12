import { useCallback, useMemo, useRef, useState } from "react";
import {
  buildSideBySideRows,
  findChangeGroups,
  findSideBySideChangeGroups,
  type DiffResult,
} from "../../domain/diff/index.ts";
import { DiffControls, type DiffViewMode } from "./DiffControls.tsx";
import { SideBySideDiff } from "./SideBySideDiff.tsx";
import { UnifiedDiff } from "./UnifiedDiff.tsx";
import styles from "./DiffViewer.module.css";

interface DiffViewerProps {
  readonly diff: DiffResult;
  readonly ignoreWhitespace: boolean;
  readonly onIgnoreWhitespaceChange: (value: boolean) => void;
}

export function DiffViewer({ diff, ignoreWhitespace, onIgnoreWhitespaceChange }: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<DiffViewMode>("side-by-side");
  const [currentChangeIndex, setCurrentChangeIndex] = useState(-1);
  const rowRefs = useRef(new Map<number, HTMLElement>());

  const sideBySideRows = useMemo(() => buildSideBySideRows(diff), [diff]);
  const groups = useMemo(
    () =>
      viewMode === "unified"
        ? findChangeGroups(diff.lines)
        : findSideBySideChangeGroups(sideBySideRows),
    [viewMode, diff.lines, sideBySideRows],
  );

  const registerRowRef = useCallback((index: number, element: HTMLElement | null) => {
    if (element) {
      rowRefs.current.set(index, element);
    } else {
      rowRefs.current.delete(index);
    }
  }, []);

  const goToGroup = (index: number) => {
    setCurrentChangeIndex(index);
    const group = groups[index];
    if (group) {
      rowRefs.current
        .get(group.startIndex)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleViewModeChange = (mode: DiffViewMode) => {
    setViewMode(mode);
    setCurrentChangeIndex(-1);
  };

  const handlePrevChange = () => {
    if (groups.length === 0) {
      return;
    }
    goToGroup(currentChangeIndex <= 0 ? groups.length - 1 : currentChangeIndex - 1);
  };

  const handleNextChange = () => {
    if (groups.length === 0) {
      return;
    }
    goToGroup(currentChangeIndex >= groups.length - 1 ? 0 : currentChangeIndex + 1);
  };

  if (diff.identical) {
    return (
      <section className={styles.viewer} aria-label="Diff viewer">
        <p className={styles.identicalBanner} role="status">
          Files are identical — no differences found.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.viewer} aria-label="Diff viewer">
      <DiffControls
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        ignoreWhitespace={ignoreWhitespace}
        onIgnoreWhitespaceChange={onIgnoreWhitespaceChange}
        addedCount={diff.addedCount}
        removedCount={diff.removedCount}
        currentChangeIndex={currentChangeIndex}
        totalChanges={groups.length}
        onPrevChange={handlePrevChange}
        onNextChange={handleNextChange}
      />
      <div className={styles.scrollArea}>
        {viewMode === "unified" ? (
          <UnifiedDiff lines={diff.lines} registerRowRef={registerRowRef} />
        ) : (
          <SideBySideDiff rows={sideBySideRows} registerRowRef={registerRowRef} />
        )}
      </div>
    </section>
  );
}
