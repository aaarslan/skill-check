import { useCallback, useEffect, useRef, useState } from "react";
import {
  INPUT_LIMITS,
  decodeUtf8,
  normalizePackagePath,
  validateContent,
} from "../domain/review/input.ts";
import { toLoadedFile } from "../domain/shared/loadedFile.ts";
import type { LoadedFile } from "../domain/shared/types.ts";

export type FileLoadState =
  | { readonly status: "idle" }
  | { readonly status: "loading"; readonly file: LoadedFile | null }
  | { readonly status: "loaded"; readonly file: LoadedFile }
  | { readonly status: "error"; readonly message: string; readonly file: LoadedFile | null };

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
  // Guards against a stale file-read promise (from a superseded load) overwriting
  // the state set by a later load/clear call.
  const requestIdRef = useRef(0);
  const lastFileRef = useRef<LoadedFile | null>(null);
  const fail = (message: string) =>
    setState({ status: "error", message, file: lastFileRef.current });
  const succeed = (file: LoadedFile) => {
    lastFileRef.current = file;
    setState({ status: "loaded", file });
  };
  useEffect(
    () => () => {
      requestIdRef.current++;
    },
    [],
  );

  const loadFromFile = useCallback((file: File) => {
    const requestId = ++requestIdRef.current;

    if (!hasAcceptedExtension(file.name)) {
      fail(`"${file.name}" isn't a .md or .txt file.`);
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      fail(`"${file.name}" is too large (max 256 KiB).`);
      return;
    }

    setState({ status: "loading", file: lastFileRef.current });
    void (async () => {
      try {
        let bytes: ArrayBuffer;
        try {
          bytes = await file.arrayBuffer();
        } catch {
          throw new Error(`Could not read "${file.name}".`);
        }
        let content: string;
        try {
          content = decodeUtf8(bytes);
        } catch {
          throw new Error(`"${file.name}" must be valid UTF-8 text.`);
        }
        if (requestIdRef.current !== requestId) return;
        succeed(toLoadedFile(validateContent(content), normalizePackagePath(file.name)));
      } catch (cause) {
        if (requestIdRef.current !== requestId) return;
        fail(cause instanceof Error ? cause.message : "Invalid text file.");
      }
    })();
  }, []);

  const loadFromText = useCallback((text: string) => {
    requestIdRef.current++;
    try {
      succeed(toLoadedFile(validateContent(text), null));
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "Invalid text.");
    }
  }, []);

  const clear = useCallback(() => {
    requestIdRef.current++;
    lastFileRef.current = null;
    setState({ status: "idle" });
  }, []);

  return { state, loadFromFile, loadFromText, clear };
}
