import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { App } from "./App.tsx";
import { analyzeReview, type AnalyzeOptions, type ReviewMode } from "./domain/review/analyze.ts";
import type { ReviewSource } from "./domain/review/input.ts";

class ControlledWorker {
  static current: ControlledWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  request: {
    id: number;
    mode: ReviewMode;
    sources: ReviewSource[];
    options: AnalyzeOptions;
  } | null = null;
  constructor() {
    ControlledWorker.current = this;
  }
  postMessage(request: NonNullable<ControlledWorker["request"]>) {
    this.request = request;
  }
  terminate() {}
  complete() {
    const request = this.request!;
    this.onmessage?.({
      data: {
        id: request.id,
        review: analyzeReview(request.mode, request.sources, request.options),
      },
    });
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("worker report availability", () => {
  it("removes all exports for pending and failed snapshots, then restores them for the current result", async () => {
    vi.stubGlobal("Worker", ControlledWorker);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Try review example" }));
    expect(screen.queryByRole("button", { name: /Export/u })).not.toBeInTheDocument();
    await act(async () => ControlledWorker.current.complete());
    expect(screen.getAllByRole("button", { name: /Export/u })).toHaveLength(3);
    const original = screen.getByRole("region", { name: "File" });
    fireEvent.change(within(original).getByRole("textbox"), {
      target: { value: "# Changed\nReview changed behavior." },
    });
    fireEvent.click(within(original).getByRole("button", { name: "Apply changes" }));
    expect(screen.queryByRole("button", { name: /Export/u })).not.toBeInTheDocument();
    await act(async () => ControlledWorker.current.onerror?.());
    expect(screen.getByRole("alert")).toHaveTextContent(/worker failed/u);
    expect(screen.queryByRole("button", { name: /Export/u })).not.toBeInTheDocument();
    fireEvent.change(within(original).getByRole("textbox"), {
      target: { value: "# Recovered\nReview current behavior." },
    });
    fireEvent.click(within(original).getByRole("button", { name: "Apply changes" }));
    await act(async () => ControlledWorker.current.complete());
    expect(screen.getAllByRole("button", { name: /Export/u })).toHaveLength(3);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
