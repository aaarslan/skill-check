import { analyzeReview, type AnalyzeOptions, type ReviewMode } from "./analyze.ts";
import type { ReviewSource } from "./input.ts";

interface WorkerRequest {
  readonly id: number;
  readonly mode: ReviewMode;
  readonly sources: readonly ReviewSource[];
  readonly options?: AnalyzeOptions;
}

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: unknown) => void;
};

scope.onmessage = (event) => {
  const { id, mode, sources, options } = event.data;
  try {
    scope.postMessage({ id, review: analyzeReview(mode, sources, options) });
  } catch (cause) {
    scope.postMessage({
      id,
      error: cause instanceof Error ? cause.message : "Analysis failed in worker.",
    });
  }
};
