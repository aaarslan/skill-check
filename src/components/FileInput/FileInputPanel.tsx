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
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const expandButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastSyncedRef = useRef<string | null>(null);
  const wasExpandedRef = useRef(false);
  const currentFile = loader.state.status === "idle" ? null : loader.state.file;
  const isLoaded = currentFile !== null;
  const loadedContent = currentFile?.content ?? null;
  const hasUnappliedChanges = isLoaded && draftText !== loadedContent;

  useEffect(() => {
    if (!currentFile) {
      lastSyncedRef.current = null;
      return;
    }
    setDraftText((previous) => {
      const dirty = lastSyncedRef.current !== null && previous !== lastSyncedRef.current;
      return dirty ? previous : currentFile.content;
    });
    lastSyncedRef.current = currentFile.content;
  }, [currentFile]);

  useEffect(() => {
    if (isExpanded) {
      wasExpandedRef.current = true;
      textareaRef.current?.focus();
    } else if (wasExpandedRef.current) {
      wasExpandedRef.current = false;
      expandButtonRef.current?.focus();
    }
  }, [isExpanded]);

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isExpanded && event.key === "Escape") {
      event.preventDefault();
      setIsExpanded(false);
    }
  };

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
    if (draftText.length > 0) {
      loader.loadFromText(draftText);
      setIsExpanded(false);
    }
  };

  const handleClear = () => {
    loader.clear();
    lastSyncedRef.current = null;
    setDraftText("");
  };

  const applyButtonDisabled = draftText.length === 0 || (isLoaded && !hasUnappliedChanges);
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

      {currentFile && (
        <div className={styles.loadedInfo} aria-live="polite">
          <CheckCircle className={styles.loadedIcon} size={29} weight="fill" aria-hidden="true" />
          <div className={styles.loadedCopy}>
            <strong>{currentFile.filename ?? "Pasted Markdown"}</strong>
            <span>
              {formatBytes(currentFile.sizeBytes)} · {currentFile.wordCount.toLocaleString()} words
              · {currentFile.lineCount.toLocaleString()} lines
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

      <div
        className={styles.textEntry}
        data-expanded={isExpanded}
        role={isExpanded ? "dialog" : undefined}
        aria-modal={isExpanded || undefined}
        aria-label={isExpanded ? `${slotLabel} Markdown editor` : undefined}
        onKeyDown={handleEditorKeyDown}
      >
        <div className={styles.editorChrome}>
          <span className={styles.lineNumbers} aria-hidden="true">
            1<br />2
          </span>
          <textarea
            ref={textareaRef}
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
            ref={expandButtonRef}
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
