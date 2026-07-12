import { useCallback, useRef, useState } from "react";
import { toLoadedFile } from "../domain/shared/loadedFile.ts";
import type { LoadedFile } from "../domain/shared/types.ts";

export type FileLoadState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly file: LoadedFile }
  | { readonly status: "error"; readonly message: string };

const ACCEPTED_EXTENSIONS = [".md", ".markdown", ".txt"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

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

  const loadFromFile = useCallback((file: File) => {
    const requestId = ++requestIdRef.current;

    if (!hasAcceptedExtension(file.name)) {
      setState({ status: "error", message: `"${file.name}" isn't a .md or .txt file.` });
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setState({ status: "error", message: `"${file.name}" is too large (max 5 MB).` });
      return;
    }

    setState({ status: "loading" });
    const reader = new FileReader();
    reader.onload = () => {
      if (requestIdRef.current !== requestId) {
        return;
      }
      const content = typeof reader.result === "string" ? reader.result : "";
      setState({ status: "loaded", file: toLoadedFile(content, file.name) });
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
    setState({ status: "loaded", file: toLoadedFile(text, null) });
  }, []);

  const clear = useCallback(() => {
    requestIdRef.current++;
    setState({ status: "idle" });
  }, []);

  return { state, loadFromFile, loadFromText, clear };
}
