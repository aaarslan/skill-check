import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { App } from "./App.tsx";

const ORIGINAL_TEXT = "# Original skill\n\nReview the requested change.";
const CANDIDATE_TEXT = "# Candidate skill\n\nReview the requested change and report findings.";

describe("App", () => {
  it("shows quality analysis after loading only one file", () => {
    render(<App />);

    const originalPanel = screen.getByRole("region", { name: "Original" });
    const originalEditor = within(originalPanel).getByRole("textbox", {
      name: "Paste Original Markdown",
    });

    fireEvent.change(originalEditor, { target: { value: ORIGINAL_TEXT } });
    fireEvent.click(within(originalPanel).getByRole("button", { name: "Use this text" }));

    expect(screen.getByRole("tab", { name: "Quality score" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByLabelText("Quality score: 83")).toBeInTheDocument();
    expect(screen.getByLabelText("Risk: Low")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Original quality" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Candidate quality" })).not.toBeInTheDocument();
  });

  it("keeps loaded file controls and editors together", () => {
    render(<App />);

    expect(screen.queryByRole("button", { name: "Sample files" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View results" })).not.toBeInTheDocument();

    const originalPanel = screen.getByRole("region", { name: "Original" });
    const candidatePanel = screen.getByRole("region", { name: "Candidate" });
    const originalEditor = within(originalPanel).getByRole("textbox", {
      name: "Paste Original Markdown",
    });
    const candidateEditor = within(candidatePanel).getByRole("textbox", {
      name: "Paste Candidate Markdown",
    });

    fireEvent.change(originalEditor, { target: { value: ORIGINAL_TEXT } });
    fireEvent.click(within(originalPanel).getByRole("button", { name: "Use this text" }));
    fireEvent.change(candidateEditor, { target: { value: CANDIDATE_TEXT } });
    fireEvent.click(within(candidatePanel).getByRole("button", { name: "Use this text" }));

    expect(within(originalPanel).getByText("Pasted Markdown")).toBeInTheDocument();
    expect(within(originalPanel).getByRole("button", { name: "Remove" })).toBeInTheDocument();
    expect(originalEditor).toHaveValue(ORIGINAL_TEXT);
    expect(screen.getByText("Candidate vs. original")).toBeInTheDocument();
  });

  it("supports arrow-key tab navigation", () => {
    render(<App />);
    const overviewTab = screen.getByRole("tab", { name: "Overview" });

    overviewTab.focus();
    fireEvent.keyDown(overviewTab, { key: "ArrowRight" });

    expect(screen.getByRole("tab", { name: "Diff" })).toHaveAttribute("aria-selected", "true");
  });
});
