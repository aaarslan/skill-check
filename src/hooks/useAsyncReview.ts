import { useEffect, useMemo, useRef, useState } from "react";
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

interface PendingEntry {
  readonly resolve: (review: Review) => void;
  readonly reject: (cause: Error) => void;
  readonly cleanup: () => void;
}

const REQUEST_TIMEOUT_MS = 20_000;
const FALLBACK_BYTES = 32 * 1024;
const FALLBACK_LINES = 500;

let worker: Worker | null = null;
let workerUnavailable = false;
let nextRequestId = 1;
const pending = new Map<number, PendingEntry>();

function resetWorker(cause: Error) {
  worker?.terminate();
  worker = null;
  const entries = [...pending.values()];
  pending.clear();
  for (const entry of entries) {
    entry.cleanup();
    entry.reject(cause);
  }
}

function getWorker(): Worker | null {
  if (workerUnavailable || typeof Worker === "undefined") return null;
  if (!worker) {
    try {
      const active = new Worker(new URL("../domain/review/analysisWorker.ts", import.meta.url), {
        type: "module",
      });
      worker = active;
      active.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const entry = pending.get(event.data.id);
        if (!entry) return;
        pending.delete(event.data.id);
        entry.cleanup();
        if (event.data.review) entry.resolve(event.data.review);
        else entry.reject(new Error(event.data.error ?? "Analysis failed in worker."));
      };
      active.onerror = () => {
        if (worker === active)
          resetWorker(new Error("Analysis worker failed. Change the input to retry."));
      };
      active.onmessageerror = () => {
        if (worker === active)
          resetWorker(
            new Error("Analysis worker returned an unreadable result. Change the input to retry."),
          );
      };
    } catch {
      workerUnavailable = true;
      return null;
    }
  }
  return worker;
}

function analyzeWithoutWorker(
  mode: ReviewMode,
  sources: readonly ReviewSource[],
  options: AnalyzeOptions,
): Review {
  let bytes = 0;
  let lines = 0;
  if (sources.length > 10)
    throw new Error("Without Web Workers, review at most 10 files, 32 KiB and 500 lines total.");
  for (const source of sources) {
    if (source.content.length > FALLBACK_BYTES)
      throw new Error("Without Web Workers, review at most 10 files, 32 KiB and 500 lines total.");
    bytes += new TextEncoder().encode(source.content).length;
    lines += source.content.split(/\r\n?|\n/u).length;
    if (bytes > FALLBACK_BYTES || lines > FALLBACK_LINES)
      throw new Error("Without Web Workers, review at most 10 files, 32 KiB and 500 lines total.");
  }
  return analyzeReview(mode, sources, options);
}

export function analyzeReviewAsync(
  mode: ReviewMode,
  sources: readonly ReviewSource[],
  options: AnalyzeOptions = {},
  signal?: AbortSignal,
): Promise<Review> {
  if (signal?.aborted) return Promise.reject(new Error("Analysis aborted."));
  let active = getWorker();
  if (!active)
    return Promise.resolve().then(() => {
      if (signal?.aborted) throw new Error("Analysis aborted.");
      return analyzeWithoutWorker(mode, sources, options);
    });
  if (pending.size > 0) {
    resetWorker(new Error("Analysis superseded by a newer request."));
    active = getWorker();
    if (!active) return Promise.reject(new Error("Analysis worker could not restart."));
  }
  const id = nextRequestId++;
  return new Promise<Review>((resolve, reject) => {
    const abort = () => {
      if (pending.has(id)) resetWorker(new Error("Analysis aborted."));
    };
    const timer = setTimeout(() => {
      resetWorker(new Error("Analysis timed out. Reduce the input and apply changes to retry."));
    }, REQUEST_TIMEOUT_MS);
    const entry: PendingEntry = {
      resolve,
      reject,
      cleanup: () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      },
    };
    pending.set(id, entry);
    signal?.addEventListener("abort", abort, { once: true });
    try {
      active.postMessage({ id, mode, sources, options });
    } catch {
      resetWorker(new Error("Analysis could not be sent to the worker."));
    }
  });
}

interface ReviewState {
  readonly signature: string;
  readonly review: Review | null;
  readonly error: string | null;
}

export function useAsyncReview(
  mode: ReviewMode,
  sources: readonly ReviewSource[],
  options: AnalyzeOptions = {},
): { review: Review | null; pending: boolean; error: string | null } {
  const { packageRootName } = options;
  const stableOptions = useMemo<AnalyzeOptions>(
    () => (packageRootName ? { packageRootName } : {}),
    [packageRootName],
  );
  const signature = useMemo(
    () => JSON.stringify([mode, packageRootName, sources]),
    [mode, sources, packageRootName],
  );
  const syncFallback = useMemo(() => {
    if (typeof Worker !== "undefined" || !sources.length) return null;
    try {
      return {
        review: analyzeWithoutWorker(mode, sources, stableOptions),
        pending: false,
        error: null,
      };
    } catch (cause) {
      return {
        review: null,
        pending: false,
        error: cause instanceof Error ? cause.message : "Analysis failed.",
      };
    }
  }, [mode, sources, stableOptions]);
  const [state, setState] = useState<ReviewState | null>(null);
  const completedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sources.length || typeof Worker === "undefined") return;
    if (completedSignatureRef.current === signature) return;
    let cancelled = false;
    const controller = new AbortController();
    void analyzeReviewAsync(mode, sources, stableOptions, controller.signal)
      .then((review) => {
        if (cancelled) return;
        completedSignatureRef.current = signature;
        setState({ signature, review, error: null });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        completedSignatureRef.current = signature;
        setState({
          signature,
          review: null,
          error: cause instanceof Error ? cause.message : "Analysis failed.",
        });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [mode, sources, signature, stableOptions]);

  if (!sources.length) return { review: null, pending: false, error: null };
  if (syncFallback) return syncFallback;
  if (state?.signature !== signature) return { review: null, pending: true, error: null };
  return { review: state.review, pending: false, error: state.error };
}
