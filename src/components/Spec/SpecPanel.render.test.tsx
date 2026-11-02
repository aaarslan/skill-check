import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { validateSkillDocument } from "../../domain/spec/validate.ts";
import { SpecPanel } from "./SpecPanel.tsx";

describe("SpecPanel", () => {
  it("renders findings with rule ids and line numbers", () => {
    const findings = validateSkillDocument("# No frontmatter\n", "SKILL.md");
    render(<SpecPanel slotLabel="Original" findings={findings} />);
    expect(screen.getByText("Original: Agent Skills spec")).toBeInTheDocument();
    expect(screen.getByText(/spec\/frontmatter-missing/u)).toBeInTheDocument();
    expect(screen.getByText(/Line 1/u)).toBeInTheDocument();
  });
  it("renders the compliant empty state", () => {
    render(<SpecPanel slotLabel="Candidate" findings={[]} />);
    expect(screen.getByText(/No spec-compliance findings/u)).toBeInTheDocument();
  });
});
