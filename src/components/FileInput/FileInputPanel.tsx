import { useId, useState, type ChangeEvent, type DragEvent } from "react";
import type { FileLoaderApi } from "../../hooks/useFileLoader.ts";
import { formatBytes } from "../format.ts";
import styles from "./FileInputPanel.module.css";

interface FileInputPanelProps {
  readonly slotLabel: string;
  readonly loader: FileLoaderApi;
}

export function FileInputPanel({ slotLabel, loader }: FileInputPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [draftText, setDraftText] = useState("");
  const textareaId = useId();

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
    }
  };

  const handleClear = () => {
    loader.clear();
    setDraftText("");
  };

  return (
    <section className={styles.panel} aria-labelledby={`${textareaId}-heading`}>
      <h2 id={`${textareaId}-heading`} className={styles.heading}>
        {slotLabel}
      </h2>

      {loader.state.status !== "loaded" && (
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
              />
              <span>Drag &amp; drop a .md file here, or click to browse</span>
            </label>
          </div>

          <div className={styles.textEntry}>
            <label htmlFor={textareaId} className={styles.textEntryLabel}>
              Or paste Markdown directly
            </label>
            <textarea
              id={textareaId}
              className={styles.textarea}
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              placeholder="# My Skill&#10;&#10;..."
              rows={6}
            />
            <button
              type="button"
              className={styles.loadTextButton}
              onClick={handleLoadPastedText}
              disabled={draftText.trim().length === 0}
            >
              Use this text
            </button>
          </div>

          {loader.state.status === "loading" && (
            <p className={styles.status} role="status">
              Reading file...
            </p>
          )}
          {loader.state.status === "error" && (
            <p className={styles.error} role="alert">
              {loader.state.message}
            </p>
          )}
        </>
      )}

      {loader.state.status === "loaded" && (
        <div className={styles.loadedInfo}>
          <dl className={styles.metaList}>
            <div>
              <dt>File</dt>
              <dd>{loader.state.file.filename ?? "Pasted text"}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{formatBytes(loader.state.file.sizeBytes)}</dd>
            </div>
            <div>
              <dt>Words</dt>
              <dd>{loader.state.file.wordCount.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Lines</dt>
              <dd>{loader.state.file.lineCount.toLocaleString()}</dd>
            </div>
          </dl>
          <button type="button" className={styles.clearButton} onClick={handleClear}>
            Clear
          </button>
        </div>
      )}
    </section>
  );
}
