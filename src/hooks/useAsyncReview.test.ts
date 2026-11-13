import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { analyzeReview } from "../domain/review/analyze.ts";
import { analyzeReviewAsync, useAsyncReview } from "./useAsyncReview.ts";

const first = [{ path: "SKILL.md", content: "# First\nDo it." }];
const second = [{ path: "SKILL.md", content: "# Second\nDo it differently." }];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("analysis without Web Workers", () => {
  it("matches the synchronous analyzer for bounded input", async () => {
    await expect(analyzeReviewAsync("single", first)).resolves.toEqual(
      analyzeReview("single", first),
    );
  });

  it("rejects invalid input", async () => {
    await expect(analyzeReviewAsync("compare", first)).rejects.toThrow(/exactly two/u);
  });

  it("rejects large and high-line-count input before synchronous analysis", async () => {
    await expect(
      analyzeReviewAsync("single", [{ path: "SKILL.md", content: "x".repeat(32769) }]),
    ).rejects.toThrow(/Without Web Workers/u);
    await expect(
      analyzeReviewAsync("single", [{ path: "SKILL.md", content: "x\n".repeat(501) }]),
    ).rejects.toThrow(/Without Web Workers/u);
  });

  it("does not start a fallback when already canceled", async () => {
    const controller = new AbortController();
    const request = analyzeReviewAsync("single", first, {}, controller.signal);
    controller.abort();
    await expect(request).rejects.toThrow(/aborted/u);
  });

  it("returns an actionable failure instead of throwing while rendering", () => {
    const { result } = renderHook(() =>
      useAsyncReview("single", [{ path: "SKILL.md", content: "x".repeat(32769) }]),
    );
    expect(result.current.review).toBeNull();
    expect(result.current.pending).toBe(false);
    expect(result.current.error).toMatch(/Without Web Workers/u);
  });

  it("returns null for no sources and a review for one source", () => {
    const empty = renderHook(() => useAsyncReview("single", []));
    expect(empty.result.current).toEqual({ review: null, pending: false, error: null });
    const { result } = renderHook(() => useAsyncReview("single", first));
    expect(result.current.review?.documents).toHaveLength(1);
  });
});

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  lastMessage: { id: number } | null = null;
  terminated = false;
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(message: { id: number }) {
    this.lastMessage = message;
  }
  terminate() {
    this.terminated = true;
  }
  respond(review: unknown) {
    this.onmessage?.({ data: { id: this.lastMessage?.id, review } });
  }
}

describe("worker analysis", () => {
  beforeEach(() => {
    vi.resetModules();
    FakeWorker.instances = [];
    vi.stubGlobal("Worker", FakeWorker);
  });

  it("clears old reports while pending and terminates superseded computation", async () => {
    const { useAsyncReview: hook } = await import("./useAsyncReview.ts");
    const { result, rerender, unmount } = renderHook(({ sources }) => hook("single", sources), {
      initialProps: { sources: first },
    });
    const initialWorker = FakeWorker.instances.at(-1)!;
    await act(async () => initialWorker.respond(analyzeReview("single", first)));
    expect(result.current.review?.documents[0]?.file.content).toContain("First");
    rerender({ sources: second });
    expect(result.current).toEqual({ review: null, pending: true, error: null });
    const third = [{ path: "SKILL.md", content: "# Third\nDo it a third way." }];
    rerender({ sources: third });
    expect(initialWorker.terminated).toBe(true);
    const thirdWorker = FakeWorker.instances.at(-1)!;
    expect(thirdWorker).not.toBe(initialWorker);
    await act(async () => thirdWorker.respond(analyzeReview("single", third)));
    expect(result.current.review?.documents[0]?.file.content).toContain("Third");
    expect(result.current.pending).toBe(false);
    const postedId = thirdWorker.lastMessage?.id;
    rerender({ sources: [...third] });
    expect(thirdWorker.lastMessage?.id).toBe(postedId);
    unmount();
  });

  it("times out by terminating work and exposes failure without a main-thread fallback", async () => {
    vi.useFakeTimers();
    const { useAsyncReview: hook } = await import("./useAsyncReview.ts");
    const { result, rerender, unmount } = renderHook(({ sources }) => hook("single", sources), {
      initialProps: { sources: first },
    });
    const active = FakeWorker.instances.at(-1)!;
    await act(async () => active.respond(analyzeReview("single", first)));
    rerender({ sources: second });
    await act(async () => vi.advanceTimersByTimeAsync(20_000));
    expect(active.terminated).toBe(true);
    expect(result.current.review).toBeNull();
    expect(result.current.pending).toBe(false);
    expect(result.current.error).toMatch(/timed out/u);
    unmount();
  });

  it("terminates canceled work and starts a new worker for the next request", async () => {
    const { analyzeReviewAsync: analyze } = await import("./useAsyncReview.ts");
    const controller = new AbortController();
    const request = analyze("single", first, {}, controller.signal);
    const rejected = expect(request).rejects.toThrow(/aborted/u);
    const abandoned = FakeWorker.instances.at(-1)!;
    controller.abort();
    await rejected;
    expect(abandoned.terminated).toBe(true);
    const next = analyze("single", second);
    const active = FakeWorker.instances.at(-1)!;
    expect(active).not.toBe(abandoned);
    active.respond(analyzeReview("single", second));
    await expect(next).resolves.toEqual(analyzeReview("single", second));
  });

  it("rejects worker failures and removes abort listeners after settling", async () => {
    const { analyzeReviewAsync: analyze } = await import("./useAsyncReview.ts");
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, "removeEventListener");
    const request = analyze("single", first, {}, controller.signal);
    const rejected = expect(request).rejects.toThrow(/worker failed/u);
    const active = FakeWorker.instances.at(-1)!;
    active.onerror?.();
    await rejected;
    expect(active.terminated).toBe(true);
    expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("does not recompute worker-reported analysis errors on the main thread", async () => {
    const { analyzeReviewAsync: analyze } = await import("./useAsyncReview.ts");
    const request = analyze("single", first);
    const active = FakeWorker.instances.at(-1)!;
    active.onmessage?.({ data: { id: active.lastMessage?.id, error: "specific worker failure" } });
    await expect(request).rejects.toThrow("specific worker failure");
  });
});
