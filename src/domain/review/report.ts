import type { Review } from "./analyze.ts";

export interface FindingDecision {
  readonly status: "open" | "reviewed" | "dismissed";
  readonly note: string;
}
export type Decisions = Readonly<Record<string, FindingDecision>>;

export function reviewFindings(review: Review) {
  return review.documents.flatMap((document) => {
    const path = document.file.filename ?? "SKILL.md";
    return [
      ...document.quality.findings.map((finding, index) => ({
        id: `${path}:quality:${index}`,
        path,
        rule: finding.ruleId,
        level: finding.severity,
        line: finding.location?.line ?? null,
        message: finding.message,
        suggestion: finding.suggestion,
      })),
      ...document.injection.map((finding, index) => ({
        id: `${path}:injection:${index}`,
        path,
        rule: finding.ruleId,
        level: finding.suspicion,
        line: finding.location.line,
        message: finding.rationale,
        suggestion: finding.isQuotedExample
          ? "Review the quoted context before deciding whether this instruction applies."
          : "Remove or narrow this instruction if it is not authorized by the intended task.",
      })),
    ];
  });
}

export function exportReview(review: Review, decisions: Decisions) {
  // Never export stale decisions from a different set of findings.
  const findings = reviewFindings(review).map((finding) => ({
    ...finding,
    decision: decisions[finding.id] ?? { status: "open", note: "" },
  }));
  return { ...review, findings };
}

function escapeMarkdown(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/[\\`*_{}[\]()#+.!|~-]/gu, "\\$&")
    .replace(/\r?\n/gu, " ");
}

export function markdownReport(review: Review, decisions: Decisions): string {
  const exported = exportReview(review, decisions);
  return [
    "# Skillcheck review",
    "",
    `Report schema: ${review.schemaVersion} · Rules: ${review.ruleVersion} · Mode: ${review.mode}`,
    "",
    ...review.limitations.map((limit) => `- ${limit}`),
    "",
    "## Files",
    "",
    ...review.documents.map(
      (document) =>
        `- ${escapeMarkdown(document.file.filename ?? "SKILL.md")}: quality ${document.quality.score}/100; ${document.injection.length} injection signals; ${document.file.sizeBytes} bytes`,
    ),
    "",
    ...(review.comparison
      ? [
          `Comparison: ${review.documents[0]!.quality.score} → ${review.documents[1]!.quality.score} (heuristic quality score).`,
          "",
        ]
      : []),
    "## Review decisions",
    ...(review.diff
      ? [
          `Line diff: ${review.diff.addedCount} added; ${review.diff.removedCount} removed. ${review.diff.bounded ? "Bounded whole-file replacement; counts are not minimal." : "Whitespace is significant."}`,
          "",
        ]
      : []),
    "",
    ...exported.findings.flatMap((finding) => [
      `### ${escapeMarkdown(finding.path)}${finding.line ? `:${finding.line}` : ""} · ${finding.level} · ${escapeMarkdown(finding.rule)}`,
      "",
      escapeMarkdown(finding.message),
      "",
      `Suggested review: ${escapeMarkdown(finding.suggestion)}`,
      "",
      `Decision: ${finding.decision.status}. ${escapeMarkdown(finding.decision.note)}`,
      "",
    ]),
    ...(exported.findings.length ? [] : ["No findings. This is not a safety clearance.", ""]),
    "The JSON companion includes the exact normalized source text and full analysis. This Markdown summary does not include source text.",
    "",
  ].join("\n");
}
