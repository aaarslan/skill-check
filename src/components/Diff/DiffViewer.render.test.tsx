import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { diffLines } from "../../domain/diff/diffLines.ts";
import { DiffViewer } from "./DiffViewer.tsx";

describe("DiffViewer", () => {
  it("renders a small diff without windowing", () => {
    const diff = diffLines("one\ntwo", "one\nthree");
    render(<DiffViewer diff={diff} ignoreWhitespace={false} onIgnoreWhitespaceChange={vi.fn()} />);
    expect(screen.getByLabelText("Diff viewer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show all rows" })).not.toBeInTheDocument();
  });

  it("windows past 600 rows and expands on request", () => {
    const original = Array.from({ length: 700 }, (_, i) => `line ${i}`).join("\n");
    const candidate = `${original}\nextra`;
    const diff = diffLines(original, candidate);
    render(<DiffViewer diff={diff} ignoreWhitespace={false} onIgnoreWhitespaceChange={vi.fn()} />);
    expect(screen.getByText(/Showing the first 600 of/u)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all rows" }));
    expect(screen.queryByText(/Showing the first 600 of/u)).not.toBeInTheDocument();
  });

  it("scrolls to a windowed-out change after expanding rows", async () => {
    const scroll = vi.fn();
    HTMLElement.prototype.scrollIntoView = scroll;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    const original = Array.from({ length: 700 }, (_, i) => `line ${i}`).join("\n");
    const candidate = original.replace("line 650", "CHANGED 650");
    render(
      <DiffViewer
        diff={diffLines(original, candidate)}
        ignoreWhitespace={false}
        onIgnoreWhitespaceChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Next change" }));
    await vi.waitFor(() => expect(scroll).toHaveBeenCalled());
  });

  it("announces identical files", () => {
    const diff = diffLines("same", "same");
    render(<DiffViewer diff={diff} ignoreWhitespace={false} onIgnoreWhitespaceChange={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent(/identical/u);
  });
});
