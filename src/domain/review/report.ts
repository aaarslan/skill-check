import type { Review } from "./analyze.ts";

export interface FindingDecision {
  readonly status: "open" | "reviewed" | "dismissed";
  readonly note: string;
}
export type Decisions = Readonly<Record<string, FindingDecision>>;

export function reviewFindings(review: Review) {
  const packageFindings = (review.spec ?? []).map((finding, index) => ({
    id: `package:spec:${index}`,
    path: "(package)",
    rule: finding.ruleId,
    level: finding.severity,
    line: finding.location?.line ?? null,
    message: finding.message,
    suggestion: finding.suggestion,
  }));
  return [
    ...packageFindings,
    ...review.documents.flatMap((document) => {
      const path = document.file.filename ?? "SKILL.md";
      return [
        ...(document.spec ?? []).map((finding, index) => ({
          id: `${path}:spec:${index}`,
          path,
          rule: finding.ruleId,
          level: finding.severity,
          line: finding.location?.line ?? null,
          message: finding.message,
          suggestion: finding.suggestion,
        })),
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
    }),
  ];
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

const SARIF_LEVEL: Record<string, string> = {
  high: "error",
  medium: "warning",
  low: "note",
  info: "note",
};

export function sarifReport(review: Review, decisions: Decisions) {
  const exported = exportReview(review, decisions);
  const ruleIds = [...new Set(exported.findings.map((finding) => finding.rule))].sort();
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "Skillcheck",
            version: review.ruleVersion,
            informationUri: "https://github.com/aaarslan/skill-check#readme",
            rules: ruleIds.map((id) => ({
              id,
              shortDescription: { text: id },
              properties: { "skillcheck/reportSchema": review.schemaVersion },
            })),
          },
        },
        results: exported.findings.map((finding) => ({
          ruleId: finding.rule,
          level: SARIF_LEVEL[finding.level] ?? "note",
          message: { text: `${finding.message} Suggestion: ${finding.suggestion}` },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: finding.path },
                region: { startLine: Math.max(1, finding.line ?? 1) },
              },
            },
          ],
          properties: { decision: finding.decision.status, level: finding.level },
        })),
      },
    ],
  };
}

export function importDecisions(jsonText: string, review: Review): Decisions {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Report file is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object")
    throw new Error("Report file is not a Skillcheck report.");
  const candidate = parsed as { schemaVersion?: unknown; findings?: unknown };
  if (typeof candidate.schemaVersion !== "string" || !candidate.schemaVersion.startsWith("1."))
    throw new Error("Unsupported report schema; expected a 1.x Skillcheck report.");
  if (!Array.isArray(candidate.findings)) throw new Error("Report has no findings array.");
  const validIds = new Set(reviewFindings(review).map((finding) => finding.id));
  const decisions: Record<string, FindingDecision> = {};
  for (const entry of candidate.findings) {
    if (!entry || typeof entry !== "object") continue;
    const finding = entry as { id?: unknown; decision?: { status?: unknown; note?: unknown } };
    if (typeof finding.id !== "string" || !validIds.has(finding.id)) continue;
    const status = finding.decision?.status;
    if (status !== "open" && status !== "reviewed" && status !== "dismissed") continue;
    decisions[finding.id] = {
      status,
      note: typeof finding.decision?.note === "string" ? finding.decision.note.slice(0, 4000) : "",
    };
  }
  return decisions;
}
