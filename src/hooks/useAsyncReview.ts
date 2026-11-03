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
  readonly rejectRaw: (cause: Error) => void;
  readonly fallback: () => Review;
  timer: ReturnType<typeof setTimeout> | null;
}

const REQUEST_TIMEOUT_MS = 20_000;

let worker: Worker | null = null;
let workerBroken = false;
let nextRequestId = 1;
const pending = new Map<number, PendingEntry>();

function settleAllPending(cause: Error, runFallback: boolean) {
  const entries = [...pending.values()];
  pending.clear();
  for (const entry of entries) {
    if (entry.timer) clearTimeout(entry.timer);
    if (!runFallback) {
      entry.rejectRaw(cause);
      continue;
    }
    try {
      entry.resolve(entry.fallback());
    } catch {
      entry.rejectRaw(cause);
    }
  }
}

function resetWorker(cause: Error, runFallback: boolean, broken: boolean) {
  worker?.terminate();
  worker = null;
  if (broken) workerBroken = true;
  settleAllPending(cause, runFallback);
}

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
        if (entry.timer) clearTimeout(entry.timer);
        if (event.data.review) entry.resolve(event.data.review);
        else {
          try {
            entry.resolve(entry.fallback());
          } catch {
            entry.rejectRaw(new Error(event.data.error ?? "Analysis failed in worker."));
          }
        }
      };
      worker.onerror = () => resetWorker(new Error("Analysis worker failed."), true, true);
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
  signal?: AbortSignal,
): Promise<Review> {
  let active = getWorker();
  if (!active) return Promise.resolve().then(() => analyzeReview(mode, sources, options));
  if (pending.size > 0) {
    // The single worker analyzes serially, so a queued stale snapshot only
    // delays the current one. Restart it and drop superseded requests.
    resetWorker(new Error("Analysis superseded by a newer request."), false, false);
    active = getWorker();
    if (!active) return Promise.resolve().then(() => analyzeReview(mode, sources, options));
  }
  const id = nextRequestId++;
  return new Promise<Review>((resolvePromise, rejectPromise) => {
    const entry: PendingEntry = {
      resolve: resolvePromise,
      rejectRaw: rejectPromise,
      fallback: () => analyzeReview(mode, sources, options),
      timer: setTimeout(() => {
        resetWorker(new Error("Analysis timed out."), true, false);
      }, REQUEST_TIMEOUT_MS),
    };
    pending.set(id, entry);
    signal?.addEventListener(
      "abort",
      () => {
        if (pending.delete(id)) {
          if (entry.timer) clearTimeout(entry.timer);
          entry.rejectRaw(new Error("Analysis aborted."));
        }
      },
      { once: true },
    );
    if (signal?.aborted) {
      pending.delete(id);
      if (entry.timer) clearTimeout(entry.timer);
      entry.rejectRaw(new Error("Analysis aborted."));
      return;
    }
    active.postMessage({ id, mode, sources, options });
  });
}

export function useAsyncReview(
  mode: ReviewMode,
  sources: readonly ReviewSource[],
  options: AnalyzeOptions = {},
): { review: Review | null; pending: boolean } {
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
  const completedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sources.length || typeof Worker === "undefined") return;
    if (completedSignatureRef.current === signature) return;
    let cancelled = false;
    const controller = new AbortController();
    void analyzeReviewAsync(mode, sources, stableOptions, controller.signal)
      .then((review) => {
        completedSignatureRef.current = signature;
        if (!cancelled) setState({ signature, review });
      })
      .catch(() => {
        if (cancelled) return;
        try {
          const review = analyzeReview(mode, sources, stableOptions);
          completedSignatureRef.current = signature;
          setState({ signature, review });
        } catch {}
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [mode, sources, signature, stableOptions]);

  if (!sources.length) return { review: null, pending: false };
  if (syncFallback) return { review: syncFallback, pending: false };
  // Stale-while-revalidate: keep the last completed review on screen while the
  // worker analyzes the new snapshot, so panels and tab state stay mounted.
  // Callers surface `pending` so nobody exports the stale report unknowingly.
  return { review: state?.review ?? null, pending: state?.signature !== signature };
}
