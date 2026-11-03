import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { ErrorBoundary } from "./ErrorBoundary.tsx";

function Explodes(): never {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  it("renders children normally", () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("all good")).toBeInTheDocument();
  });
  it("catches render failures and offers recovery", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Explodes />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("heading", { name: /Something went wrong/u })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload Skillcheck" })).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});

import { PanelErrorBoundary } from "./PanelErrorBoundary.tsx";

describe("PanelErrorBoundary", () => {
  it("contains a panel failure without taking down siblings", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <div>
        <p>surviving sibling</p>
        <PanelErrorBoundary label="Diff">
          <Explodes />
        </PanelErrorBoundary>
      </div>,
    );
    expect(screen.getByText("surviving sibling")).toBeInTheDocument();
    expect(screen.getByText(/Diff could not be loaded/u)).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
