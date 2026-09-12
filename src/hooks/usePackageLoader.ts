import { useCallback, useEffect, useRef, useState } from "react";
import {
  INPUT_LIMITS,
  TEXT_FILE_PATTERN,
  decodeUtf8,
  prepareSources,
  type ReviewSource,
} from "../domain/review/input.ts";

export function usePackageLoader() {
  const [sources, setSources] = useState<readonly ReviewSource[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const replace = useCallback((input: readonly ReviewSource[]) => {
    generation.current++;
    setLoading(false);
    try {
      setSources(prepareSources(input));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not review package.");
    }
  }, []);
  const clear = useCallback(() => {
    generation.current++;
    setSources([]);
    setError("");
    setLoading(false);
  }, []);
  const load = useCallback(async (files: readonly File[]) => {
    const current = ++generation.current;
    setLoading(true);
    setError("");
    setSources([]);
    try {
      if (!files.length || files.length > INPUT_LIMITS.files)
        throw new Error("Choose between 1 and 100 text files.");
      if (
        files.some((file) => file.size > INPUT_LIMITS.fileBytes) ||
        files.reduce((sum, file) => sum + file.size, 0) > INPUT_LIMITS.packageBytes
      )
        throw new Error("Limit: 256 KiB per file and 2 MiB per package.");
      if (files.some((file) => !TEXT_FILE_PATTERN.test(file.name)))
        throw new Error(
          "Choose a folder containing only supported text files. Remove binary assets, archives, and dependency folders first.",
        );
      // Folder pickers include the selected root. Strip only a verified common root.
      const relative = files.map((file) => file.webkitRelativePath || file.name);
      const root = relative[0]?.split("/")[0];
      const strip = relative.every((path) => path.includes("/") && path.split("/")[0] === root);
      const loaded = await Promise.all(
        files.map(async (file, index) => {
          let content: string;
          try {
            content = decodeUtf8(await file.arrayBuffer());
          } catch {
            throw new Error(`"${file.name}" must be valid UTF-8 text.`);
          }
          return {
            path: strip ? relative[index]!.slice(root!.length + 1) : relative[index]!,
            content,
          };
        }),
      );
      const prepared = prepareSources(loaded);
      if (current === generation.current) setSources(prepared);
    } catch (cause) {
      if (current === generation.current)
        setError(cause instanceof Error ? cause.message : "Could not read package.");
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, []);
  return { sources, error, loading, load, replace, clear };
}
