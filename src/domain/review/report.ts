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

export function sarifReport(
  review: Review,
  decisions: Decisions,
  artifactUris: Readonly<Record<string, string>> = {},
) {
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
          locations:
            finding.path === "(package)" && !(finding.path in artifactUris)
              ? []
              : [
                  {
                    physicalLocation: {
                      artifactLocation: { uri: artifactUris[finding.path] ?? finding.path },
                      ...(finding.line === null
                        ? {}
                        : { region: { startLine: Math.max(1, finding.line) } }),
                    },
                  },
                ],
          properties: {
            decision: finding.decision.status,
            level: finding.level,
            "skillcheck/reportPath": finding.path,
          },
        })),
      },
    ],
  };
}

export const REPORT_IMPORT_LIMITS = {
  bytes: 8 * 1024 * 1024,
  findings: 10_000,
  documents: 100,
  noteLength: 4000,
} as const;

export function importDecisions(jsonText: string, review: Review): Decisions {
  if (
    jsonText.length > REPORT_IMPORT_LIMITS.bytes ||
    new TextEncoder().encode(jsonText).length > REPORT_IMPORT_LIMITS.bytes
  )
    throw new Error("Report imports must be at most 8 MiB.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Report file is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object")
    throw new Error("Report file is not a Skillcheck report.");
  const candidate = parsed as {
    schemaVersion?: unknown;
    findings?: unknown;
    documents?: unknown;
  };
  if (typeof candidate.schemaVersion !== "string" || !candidate.schemaVersion.startsWith("1."))
    throw new Error("Unsupported report schema; expected a 1.x Skillcheck report.");
  if (!Array.isArray(candidate.findings)) throw new Error("Report has no findings array.");
  if (candidate.findings.length > REPORT_IMPORT_LIMITS.findings)
    throw new Error("Report imports must have at most 10,000 findings.");
  if (
    Array.isArray(candidate.documents) &&
    candidate.documents.length > REPORT_IMPORT_LIMITS.documents
  )
    throw new Error("Report imports must have at most 100 documents.");
  if (candidate.findings.length === 0) return {};
  // Finding ids are only path+kind+index, so a matching id does not prove the
  // finding is the same one. Require the imported report to carry the exact
  // sources it was produced from and refuse decisions for changed documents.
  if (!Array.isArray(candidate.documents))
    throw new Error(
      "Report does not include its source documents, so decisions cannot be verified against the current files.",
    );
  const importedSources = new Map<string, string>();
  for (const entry of candidate.documents) {
    if (!entry || typeof entry !== "object") continue;
    const file = (entry as { file?: { filename?: unknown; content?: unknown } }).file;
    if (typeof file?.content === "string")
      importedSources.set(
        typeof file.filename === "string" ? file.filename : "SKILL.md",
        file.content,
      );
  }
  for (const document of review.documents) {
    const path = document.file.filename ?? "SKILL.md";
    if (importedSources.get(path) !== document.file.content)
      throw new Error(
        "Report was produced from different source text; decisions are not imported for changed documents.",
      );
  }
  const current = new Map(
    reviewFindings(review).map((finding) => [
      finding.id,
      `${finding.rule}\u0000${finding.line ?? ""}\u0000${finding.level}\u0000${finding.message}`,
    ]),
  );
  const decisions: Record<string, FindingDecision> = {};
  for (const entry of candidate.findings) {
    if (!entry || typeof entry !== "object") continue;
    const finding = entry as {
      id?: unknown;
      rule?: unknown;
      line?: unknown;
      level?: unknown;
      message?: unknown;
      decision?: { status?: unknown; note?: unknown };
    };
    if (typeof finding.id !== "string") continue;
    if (typeof finding.rule !== "string" || typeof finding.message !== "string") continue;
    if (typeof finding.level !== "string") continue;
    if (finding.line !== null && typeof finding.line !== "number") continue;
    const identity = `${finding.rule}\u0000${finding.line ?? ""}\u0000${finding.level}\u0000${finding.message}`;
    if (current.get(finding.id) !== identity) continue;
    if (
      typeof finding.decision?.note === "string" &&
      finding.decision.note.length > REPORT_IMPORT_LIMITS.noteLength
    )
      throw new Error("Review notes must have at most 4,000 characters.");
    const status = finding.decision?.status;
    if (status !== "open" && status !== "reviewed" && status !== "dismissed") continue;
    decisions[finding.id] = {
      status,
      note: typeof finding.decision?.note === "string" ? finding.decision.note : "",
    };
  }
  return decisions;
}
