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
  const [rootName, setRootName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const replace = useCallback((input: readonly ReviewSource[], nextRootName = "") => {
    generation.current++;
    setRootName(nextRootName);
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
    setRootName("");
    setSources([]);
    setError("");
    setLoading(false);
  }, []);
  const load = useCallback(async (files: readonly File[]) => {
    const current = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const kept = files.filter((file) => {
        const segments = (file.webkitRelativePath || file.name).split("/");
        return (
          TEXT_FILE_PATTERN.test(file.name) &&
          !segments
            .slice(segments.length > 1 ? 1 : 0)
            .some((segment) => segment.startsWith(".") || segment === "node_modules")
        );
      });
      if (!kept.length || kept.length > INPUT_LIMITS.files)
        throw new Error("Choose between 1 and 100 text files.");
      if (
        kept.some((file) => file.size > INPUT_LIMITS.fileBytes) ||
        kept.reduce((sum, file) => sum + file.size, 0) > INPUT_LIMITS.packageBytes
      )
        throw new Error("Limit: 256 KiB per file and 2 MiB per package.");
      // Folder pickers include the selected root. Strip only a verified common root.
      const relative = kept.map((file) => file.webkitRelativePath || file.name);
      const root = relative[0]?.split("/")[0];
      const strip = relative.every((path) => path.includes("/") && path.split("/")[0] === root);
      const loaded = await Promise.all(
        kept.map(async (file, index) => {
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
      if (current === generation.current) {
        setRootName(strip && root ? root : "");
        setSources(prepared);
      }
    } catch (cause) {
      if (current === generation.current)
        setError(cause instanceof Error ? cause.message : "Could not read package.");
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, []);
  return { sources, rootName, error, loading, load, replace, clear };
}
