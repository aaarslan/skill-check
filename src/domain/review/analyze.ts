import { analyzeQuality } from "../quality/analyze.ts";
import { diffLines } from "../diff/diffLines.ts";
import { mergeAdditionalFindings } from "../quality/crossFileLinks.ts";
import { compareQualityReports } from "../quality/compare.ts";
import { detectInjection } from "../injection/detect.ts";
import { toLoadedFile } from "../shared/loadedFile.ts";
import { codeBlockLineSet, parseHeadings, toAnalyzableDocument } from "../shared/markdown.ts";
import {
  normalizePackagePath,
  hasControlCharacter,
  prepareSources,
  validateContent,
  type ReviewSource,
} from "./input.ts";
import type { QualityFinding } from "../quality/types.ts";

export const RULE_VERSION = "2026.09.12.1";
export const REPORT_VERSION = "1.0";
export type ReviewMode = "single" | "compare" | "package";

export function analyzeDocument(content: string, filename: string | null) {
  const normalized = validateContent(content);
  return {
    file: toLoadedFile(normalized, filename),
    quality: analyzeQuality(normalized),
    injection: detectInjection(normalized),
  };
}

function linkFinding(rule: string, message: string, line: number, excerpt: string): QualityFinding {
  return {
    ruleId: `package/${rule}`,
    category: "integrity",
    severity: "medium",
    message,
    explanation:
      "Only selected local package files and Markdown headings can be checked. No link is fetched or executed.",
    suggestion:
      "Correct the relative path or heading, or include the referenced text file in this package.",
    location: { line, excerpt },
  };
}

function localLinks(
  source: ReviewSource,
  files: ReadonlyMap<string, ReviewSource>,
): QualityFinding[] {
  const doc = toAnalyzableDocument(source.content);
  const code = codeBlockLineSet(doc);
  const findings: QualityFinding[] = [];
  const definitions = new Map<string, string>();
  for (const line of doc.lines) {
    const definition = /^\s{0,3}\[([^\]]+)\]:\s*<?([^\s>]+)>?/u.exec(line);
    if (definition) definitions.set((definition[1] ?? "").toLowerCase(), definition[2] ?? "");
  }
  doc.lines.forEach((line, index) => {
    if (code.has(index + 1)) return;
    const targets = [
      ...line.matchAll(/\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\s*\)/gu),
    ].map((m) => ({ target: m[1] ?? m[2] ?? "", excerpt: m[0] }));
    for (const match of line.matchAll(/\[([^\]]+)\]\[([^\]]*)\]/gu)) {
      const label = (match[2] || match[1] || "").toLowerCase();
      const target = definitions.get(label);
      if (target) targets.push({ target, excerpt: match[0] });
      else
        findings.push(
          linkFinding(
            "missing-reference",
            `Undefined Markdown reference: ${label}`,
            index + 1,
            match[0],
          ),
        );
    }
    for (const { target, excerpt } of targets) {
      if (!target || target.startsWith("#") || /^[a-z][a-z0-9+.-]*:/iu.test(target)) continue;
      try {
        const decoded = decodeURIComponent(target).normalize("NFC").replace(/\\/gu, "/");
        if (decoded.startsWith("/") || /[:?%]/u.test(decoded) || hasControlCharacter(decoded))
          throw new Error("invalid");
        const [path = "", fragment] = decoded.split("#");
        const parts = source.path.split("/").slice(0, -1);
        for (const segment of path.split("/")) {
          if (!segment || segment === ".") continue;
          if (segment === "..") {
            if (!parts.length) throw new Error("escape");
            parts.pop();
          } else parts.push(segment);
        }
        const resolved = parts.join("/");
        const sibling = files.get(resolved);
        if (!sibling)
          findings.push(
            linkFinding(
              "missing-file",
              `Referenced file is not in the selected package: ${resolved}`,
              index + 1,
              excerpt,
            ),
          );
        else if (
          fragment &&
          !parseHeadings(toAnalyzableDocument(sibling.content)).some(
            (heading) => heading.slug === fragment,
          )
        ) {
          findings.push(
            linkFinding(
              "missing-anchor",
              `No heading #${fragment} in ${resolved}`,
              index + 1,
              excerpt,
            ),
          );
        }
      } catch {
        findings.push(
          linkFinding(
            "unsafe-path",
            `Invalid or escaping local reference: ${target}`,
            index + 1,
            excerpt,
          ),
        );
      }
    }
  });
  return findings;
}

/** Shared browser/CLI entrypoint. Text is data; this module performs no I/O. */
export function analyzeReview(mode: ReviewMode, input: readonly ReviewSource[]) {
  const sources = prepareSources(input);
  if (mode === "single" && sources.length !== 1)
    throw new Error("One-file review requires exactly one file.");
  if (mode === "compare" && sources.length !== 2)
    throw new Error("Comparison requires exactly two files.");
  const files = new Map(sources.map((source) => [source.path, source]));
  const ordered =
    mode === "compare"
      ? input.map((source) => files.get(normalizePackagePath(source.path))!)
      : sources;
  const documents = ordered.map((source) => {
    const analysis = analyzeDocument(source.content, source.path);
    return {
      ...analysis,
      quality:
        mode === "package"
          ? mergeAdditionalFindings(analysis.quality, localLinks(source, files))
          : analysis.quality,
    };
  });
  return {
    schemaVersion: REPORT_VERSION,
    ruleVersion: RULE_VERSION,
    mode,
    documents,
    comparison:
      mode === "compare"
        ? compareQualityReports(documents[0]!.quality, documents[1]!.quality)
        : null,
    diff:
      mode === "compare" ? diffLines(documents[0]!.file.content, documents[1]!.file.content) : null,
    limitations: [
      "Static heuristic signals are not proof of skill effectiveness or safety.",
      "Only selected text is scanned; no scripts, links, imports, or instructions are executed or fetched.",
      "Local checks cover inline and full/collapsed reference Markdown links outside fenced blocks; plain-text paths, shorthand links, dynamic imports, and non-text assets are not resolved.",
      "Heading anchors approximate GitHub Markdown. Review findings and omissions manually.",
    ],
  };
}

export type Review = ReturnType<typeof analyzeReview>;
