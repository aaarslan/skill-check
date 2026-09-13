import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { App } from "./App.tsx";
import { SAMPLE_ORIGINAL } from "./domain/review/samples.ts";

const ORIGINAL_TEXT = "# Original skill\n\nReview the requested change.";
const CANDIDATE_TEXT = "# Candidate skill\n\nReview the requested change and report findings.";

describe("App", () => {
  it("starts from an example and creates an editable revision while preserving the original", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Try review example" }));
    fireEvent.click(screen.getByRole("button", { name: "Create editable candidate" }));
    const candidate = screen.getByRole("region", { name: "Candidate" });
    const editor = within(candidate).getByRole("textbox", { name: "Paste Candidate Markdown" });
    expect(editor).toHaveValue(SAMPLE_ORIGINAL);
    fireEvent.change(editor, { target: { value: "# Revised\nReview only the requested change." } });
    fireEvent.click(within(candidate).getByRole("button", { name: "Apply changes" }));
    expect(screen.getByRole("textbox", { name: "Paste Original Markdown" })).toHaveValue(
      SAMPLE_ORIGINAL,
    );
    expect(screen.getByText("Candidate vs. original")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export JSON report" })).toBeInTheDocument();
  });

  it("shares injection dismissals with report decisions and resets them when applied source changes", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Try review example" }));
    fireEvent.click(screen.getByRole("tab", { name: "Prompt injection" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Dismiss as false positive" })[0]!);
    const decision = screen.getByLabelText("Decision for original/SKILL.md:injection:0");
    const note = screen.getByLabelText("Note for original/SKILL.md:injection:0");
    expect(decision).toHaveValue("dismissed");
    fireEvent.change(note, { target: { value: "Reviewed this example in context." } });
    fireEvent.click(screen.getByRole("tab", { name: "Quality score" }));
    fireEvent.click(screen.getByRole("tab", { name: "Prompt injection" }));
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
    const original = screen.getByRole("region", { name: "Original" });
    fireEvent.change(within(original).getByRole("textbox"), {
      target: { value: `${SAMPLE_ORIGINAL}\nNew context.` },
    });
    fireEvent.click(within(original).getByRole("button", { name: "Apply changes" }));
    expect(decision).toHaveValue("open");
    expect(note).toHaveValue("");
  });

  it("reruns package links after an edit and keeps exports available", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Review folder" }));
    fireEvent.click(screen.getByRole("button", { name: "Try sample package" }));
    expect(screen.getByRole("heading", { name: "2 files reviewed" })).toBeInTheDocument();
    expect(screen.getByText(/1 package link findings/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit SKILL.md" }));
    fireEvent.change(screen.getByLabelText("Editing SKILL.md"), {
      target: { value: "# Review\nRead the [checklist](references/checklist.md#verification)." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply and review package" }));
    expect(screen.queryByText(/1 package link findings/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export Markdown report" })).toBeInTheDocument();
  });

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
    fireEvent.click(screen.getByRole("button", { name: "Compare revisions" }));

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
