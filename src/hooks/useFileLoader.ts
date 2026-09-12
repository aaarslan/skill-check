import { useCallback, useEffect, useRef, useState } from "react";
import { INPUT_LIMITS, normalizePackagePath, validateContent } from "../domain/review/input.ts";
import { toLoadedFile } from "../domain/shared/loadedFile.ts";
import type { LoadedFile } from "../domain/shared/types.ts";

export type FileLoadState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly file: LoadedFile }
  | { readonly status: "error"; readonly message: string };

const ACCEPTED_EXTENSIONS = [".md", ".markdown", ".txt"];
const MAX_FILE_SIZE_BYTES = INPUT_LIMITS.fileBytes;

function hasAcceptedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export interface FileLoaderApi {
  readonly state: FileLoadState;
  readonly loadFromFile: (file: File) => void;
  readonly loadFromText: (text: string) => void;
  readonly clear: () => void;
}

/** Manages loading a single skill file from disk or pasted text, entirely in memory. */
export function useFileLoader(): FileLoaderApi {
  const [state, setState] = useState<FileLoadState>({ status: "idle" });
  // Guards against a stale FileReader callback (from a superseded load) overwriting
  // the state set by a later load/clear call.
  const requestIdRef = useRef(0);
  useEffect(
    () => () => {
      requestIdRef.current++;
    },
    [],
  );

  const loadFromFile = useCallback((file: File) => {
    const requestId = ++requestIdRef.current;

    if (!hasAcceptedExtension(file.name)) {
      setState({ status: "error", message: `"${file.name}" isn't a .md or .txt file.` });
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setState({ status: "error", message: `"${file.name}" is too large (max 256 KiB).` });
      return;
    }

    setState({ status: "loading" });
    const reader = new FileReader();
    reader.onload = () => {
      if (requestIdRef.current !== requestId) {
        return;
      }
      const content = typeof reader.result === "string" ? reader.result : "";
      try {
        setState({
          status: "loaded",
          file: toLoadedFile(validateContent(content), normalizePackagePath(file.name)),
        });
      } catch (cause) {
        setState({
          status: "error",
          message: cause instanceof Error ? cause.message : "Invalid text file.",
        });
      }
    };
    reader.onerror = () => {
      if (requestIdRef.current !== requestId) {
        return;
      }
      setState({ status: "error", message: `Could not read "${file.name}".` });
    };
    reader.readAsText(file);
  }, []);

  const loadFromText = useCallback((text: string) => {
    requestIdRef.current++;
    try {
      setState({ status: "loaded", file: toLoadedFile(validateContent(text), null) });
    } catch (cause) {
      setState({
        status: "error",
        message: cause instanceof Error ? cause.message : "Invalid text.",
      });
    }
  }, []);

  const clear = useCallback(() => {
    requestIdRef.current++;
    setState({ status: "idle" });
  }, []);

  return { state, loadFromFile, loadFromText, clear };
}
