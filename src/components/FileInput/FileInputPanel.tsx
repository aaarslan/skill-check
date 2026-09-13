import {
  ArrowClockwise,
  ArrowsInSimple,
  ArrowsOutSimple,
  CheckCircle,
  CloudArrowUp,
  CopySimple,
  FileText,
  Trash,
} from "@phosphor-icons/react";
import { useEffect, useState, type ChangeEvent, type DragEvent } from "react";
import type { FileLoaderApi } from "../../hooks/useFileLoader.ts";
import { formatBytes } from "../format.ts";
import styles from "./FileInputPanel.module.css";

interface FileInputPanelProps {
  readonly slotLabel: string;
  readonly slotKey: "original" | "candidate";
  readonly loader: FileLoaderApi;
}

export function FileInputPanel({ slotLabel, slotKey, loader }: FileInputPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [draftText, setDraftText] = useState("");
  const textareaId = `${slotKey}-editor`;
  const descriptionId = `${slotKey}-description`;
  const isLoaded = loader.state.status === "loaded";
  const loadedContent = isLoaded ? loader.state.file.content : null;
  const hasUnappliedChanges = isLoaded && draftText !== loadedContent;

  useEffect(() => {
    if (loader.state.status === "loaded") {
      setDraftText(loader.state.file.content);
    }
  }, [loader.state]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      loader.loadFromFile(file);
    }
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      loader.loadFromFile(file);
    }
  };

  const handleLoadPastedText = () => {
    if (draftText.trim().length > 0) {
      loader.loadFromText(draftText);
      setIsExpanded(false);
    }
  };

  const handleClear = () => {
    loader.clear();
    setDraftText("");
  };

  const applyButtonDisabled = draftText.trim().length === 0 || (isLoaded && !hasUnappliedChanges);
  const applyButtonLabel = isLoaded
    ? hasUnappliedChanges
      ? "Apply changes"
      : "Changes applied"
    : "Use this text";

  return (
    <section
      className={styles.panel}
      data-slot={slotKey}
      data-loaded={isLoaded}
      aria-labelledby={`${slotKey}-heading`}
    >
      <div className={styles.panelHeader}>
        <span className={styles.fileIcon} aria-hidden="true">
          <FileText size={27} />
        </span>
        <div>
          <h2 id={`${slotKey}-heading`} className={styles.heading}>
            {slotLabel}
          </h2>
          <p id={descriptionId} className={styles.panelDescription}>
            {slotKey === "original"
              ? "First file in the comparison"
              : "Second file in the comparison"}
          </p>
        </div>
      </div>

      {!isLoaded && (
        <>
          <div
            className={styles.dropzone}
            data-dragging={isDragging}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <label className={styles.dropzoneLabel}>
              <input
                type="file"
                accept=".md,.markdown,.txt"
                className={styles.hiddenInput}
                onChange={handleFileChange}
                aria-label={`Upload ${slotLabel} skill file`}
                aria-describedby={descriptionId}
              />
              <CloudArrowUp className={styles.uploadIcon} size={39} aria-hidden="true" />
              <span className={styles.dropzonePrompt}>
                Drag &amp; drop a .md file here, or click to browse
              </span>
              <span className={styles.dropzoneHelp}>
                Markdown or text, up to 256 KiB / 4,000 lines
              </span>
              <span className={styles.browseButton}>Browse files</span>
            </label>
          </div>

          <div className={styles.separator} aria-hidden="true">
            <span>Or paste Markdown directly</span>
          </div>
        </>
      )}

      {isLoaded && (
        <div className={styles.loadedInfo} aria-live="polite">
          <CheckCircle className={styles.loadedIcon} size={29} weight="fill" aria-hidden="true" />
          <div className={styles.loadedCopy}>
            <strong>{loader.state.file.filename ?? "Pasted Markdown"}</strong>
            <span>
              {formatBytes(loader.state.file.sizeBytes)} ·{" "}
              {loader.state.file.wordCount.toLocaleString()} words ·{" "}
              {loader.state.file.lineCount.toLocaleString()} lines
            </span>
          </div>
          <label className={styles.replaceButton}>
            <input
              type="file"
              accept=".md,.markdown,.txt"
              className={styles.hiddenInput}
              onChange={handleFileChange}
              aria-label={`Replace ${slotLabel} skill file`}
            />
            <ArrowClockwise size={18} aria-hidden="true" />
            Replace
          </label>
          <button type="button" className={styles.clearButton} onClick={handleClear}>
            <Trash size={18} aria-hidden="true" />
            Remove
          </button>
        </div>
      )}

      <div className={styles.textEntry} data-expanded={isExpanded}>
        <div className={styles.editorChrome}>
          <span className={styles.lineNumbers} aria-hidden="true">
            1<br />2
          </span>
          <textarea
            id={textareaId}
            className={styles.textarea}
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            placeholder={"# My Skill\n..."}
            rows={4}
            aria-label={`Paste ${slotLabel} Markdown`}
          />
          <span className={styles.markdownBadge} aria-hidden="true">
            Markdown
          </span>
          <button
            className={styles.expandButton}
            type="button"
            aria-label={isExpanded ? "Collapse Markdown editor" : "Expand Markdown editor"}
            onClick={() => setIsExpanded((expanded) => !expanded)}
          >
            {isExpanded ? <ArrowsInSimple size={18} /> : <ArrowsOutSimple size={18} />}
          </button>
        </div>
        <button
          type="button"
          className={styles.loadTextButton}
          onClick={handleLoadPastedText}
          disabled={applyButtonDisabled}
        >
          <CopySimple size={20} aria-hidden="true" />
          {applyButtonLabel}
        </button>
      </div>

      {loader.state.status === "loading" && (
        <p className={styles.status} role="status">
          Reading file…
        </p>
      )}
      {loader.state.status === "error" && (
        <p className={styles.error} role="alert">
          {loader.state.message}
        </p>
      )}
    </section>
  );
}
