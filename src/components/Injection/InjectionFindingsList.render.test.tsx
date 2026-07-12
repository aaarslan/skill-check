import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { InjectionFinding } from "../../domain/injection/types.ts";
import type { DismissedFindingsApi } from "../../hooks/useDismissedFindings.ts";
import { InjectionFindingsList } from "./InjectionFindingsList.tsx";

const dismissedStub: DismissedFindingsApi = {
  isDismissed: () => false,
  dismiss: vi.fn(),
  restore: vi.fn(),
};

function findingWithMatchedText(matchedText: string): InjectionFinding {
  return {
    id: "test/rule:1:0",
    ruleId: "test/rule",
    category: "hidden-content",
    suspicion: "high",
    matchedText,
    location: { line: 1, excerpt: matchedText },
    rationale: "Test rationale containing <img src=x onerror=alert(1)>.",
    isQuotedExample: false,
  };
}

describe("InjectionFindingsList inert rendering", () => {
  it("renders HTML/script-like matched text as plain text, never as live DOM", () => {
    const finding = findingWithMatchedText('<script>alert("xss")</script>');
    render(<InjectionFindingsList findings={[finding]} totalCount={1} dismissed={dismissedStub} />);

    // The tag text must be visible as literal characters...
    expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument();
    // ...and must never have been parsed into an actual <script> element.
    expect(document.querySelector("script")).toBeNull();
  });

  it("renders a rationale containing an HTML-like payload as inert text", () => {
    const finding = findingWithMatchedText("some matched text");
    render(<InjectionFindingsList findings={[finding]} totalCount={1} dismissed={dismissedStub} />);

    expect(screen.getByText(/Test rationale containing/)).toBeInTheDocument();
    expect(document.querySelector("img[onerror]")).toBeNull();
  });
});
