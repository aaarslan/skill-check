import { useEffect, useMemo, useState } from "react";
import {
  analyzeReview,
  type AnalyzeOptions,
  type Review,
  type ReviewMode,
} from "../domain/review/analyze.ts";
import type { ReviewSource } from "../domain/review/input.ts";

interface WorkerResponse {
  readonly id: number;
  readonly review?: Review;
  readonly error?: string;
}

let worker: Worker | null = null;
let workerBroken = false;
let nextRequestId = 1;
const pending = new Map<
  number,
  { readonly resolve: (review: Review) => void; readonly reject: (cause: Error) => void }
>();

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === "undefined") return null;
  if (!worker) {
    try {
      worker = new Worker(new URL("../domain/review/analysisWorker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const entry = pending.get(event.data.id);
        if (!entry) return;
        pending.delete(event.data.id);
        if (event.data.review) entry.resolve(event.data.review);
        else entry.reject(new Error(event.data.error ?? "Analysis failed in worker."));
      };
      worker.onerror = () => {
        workerBroken = true;
        for (const entry of pending.values()) entry.reject(new Error("Analysis worker failed."));
        pending.clear();
        worker?.terminate();
        worker = null;
      };
    } catch {
      workerBroken = true;
      return null;
    }
  }
  return worker;
}

export function analyzeReviewAsync(
  mode: ReviewMode,
  sources: readonly ReviewSource[],
  options: AnalyzeOptions = {},
): Promise<Review> {
  const active = getWorker();
  if (!active) return Promise.resolve().then(() => analyzeReview(mode, sources, options));
  const id = nextRequestId++;
  return new Promise<Review>((resolvePromise, rejectPromise) => {
    pending.set(id, {
      resolve: resolvePromise,
      reject: (cause) => {
        try {
          resolvePromise(analyzeReview(mode, sources, options));
        } catch {
          rejectPromise(cause);
        }
      },
    });
    active.postMessage({ id, mode, sources, options });
  });
}

export function useAsyncReview(
  mode: ReviewMode,
  sources: readonly ReviewSource[],
  options: AnalyzeOptions = {},
): Review | null {
  const { packageRootName } = options;
  const stableOptions = useMemo<AnalyzeOptions>(
    () => (packageRootName ? { packageRootName } : {}),
    [packageRootName],
  );
  const signature = useMemo(
    () =>
      `${options.packageRootName ?? ""}\0${sources.map((source) => `${source.path}\0${source.content}`).join("\0")}`,
    [sources, options.packageRootName],
  );
  const syncFallback = useMemo(
    () =>
      typeof Worker === "undefined" && sources.length
        ? analyzeReview(mode, sources, stableOptions)
        : null,
    [mode, sources, stableOptions],
  );
  const [state, setState] = useState<{ signature: string; review: Review } | null>(null);

  useEffect(() => {
    if (!sources.length || typeof Worker === "undefined") return;
    let cancelled = false;
    void analyzeReviewAsync(mode, sources, stableOptions)
      .then((review) => {
        if (!cancelled) setState({ signature, review });
      })
      .catch(() => {
        if (!cancelled) {
          try {
            setState({ signature, review: analyzeReview(mode, sources, stableOptions) });
          } catch {}
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mode, sources, signature, stableOptions]);

  if (!sources.length) return null;
  if (syncFallback) return syncFallback;
  return state?.signature === signature ? state.review : null;
}
