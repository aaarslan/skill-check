import { describe, expect, it } from "vite-plus/test";
import { toAnalyzableDocument } from "../../shared/markdown.ts";
import { integrityRules } from "./integrity.ts";

const [brokenRelativeLinks, undefinedReferenceLinks, broadPermissions] = integrityRules;

describe("integrity/broken-relative-links", () => {
  it("flags an anchor link that doesn't match any heading", () => {
    const content = "## Setup\n\nSee [here](#nonexistent) for details.\n";
    const findings = brokenRelativeLinks?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(1);
    expect(findings[0]?.location?.line).toBe(3);
  });

  it("does not flag an anchor link that matches a real heading", () => {
    const content = "## Setup\n\nSee [setup](#setup) for details.\n";
    const findings = brokenRelativeLinks?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(0);
  });

  it("does not evaluate external or unrelated relative links", () => {
    const content = "See [docs](https://example.com/docs) or [file](./other.md).\n";
    const findings = brokenRelativeLinks?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(0);
  });

  it("flags a link with an empty target", () => {
    const content = "See [here]() for details.\n";
    const findings = brokenRelativeLinks?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("empty target");
  });

  it("captures the full URL when it contains a nested parenthesis", () => {
    const content = "## Setup\n\n[link](https://example.com/a(1)#setup)\n";
    const findings = brokenRelativeLinks?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(0);
  });
});

describe("integrity/undefined-reference-link", () => {
  it("flags a reference-style link with no matching definition", () => {
    const content = "See [the docs][docs-ref] for details.\n";
    const findings = undefinedReferenceLinks?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(1);
  });

  it("does not flag a reference-style link that has a matching definition", () => {
    const content = "See [the docs][docs-ref] for details.\n\n[docs-ref]: https://example.com\n";
    const findings = undefinedReferenceLinks?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(0);
  });

  it("resolves the shortcut form [text][] against the link text itself", () => {
    const content = "See [docs-ref][] for details.\n\n[docs-ref]: https://example.com\n";
    const findings = undefinedReferenceLinks?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(0);
  });

  it("does not treat a definition inside fenced code as a live reference definition", () => {
    const content = [
      "See [the docs][docs-ref] for details.",
      "",
      "```md",
      "[docs-ref]: https://example.com",
      "```",
      "",
    ].join("\n");
    const findings = undefinedReferenceLinks?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(1);
  });
});

describe("integrity/broad-permissions", () => {
  it("flags language claiming broad system authority", () => {
    const content = "This skill has full system access and can modify any file.\n";
    const findings = broadPermissions?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.every((finding) => finding.severity === "high")).toBe(true);
  });

  it("does not flag normally scoped permission language", () => {
    const content = "This skill can read files inside the project directory.\n";
    const findings = broadPermissions?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(0);
  });

  it("does not flag broad-permission terms shown only as inline code", () => {
    const content = "Document the `sudo` command, but do not grant elevated access.\n";
    const findings = broadPermissions?.evaluate(toAnalyzableDocument(content)) ?? [];
    expect(findings).toHaveLength(0);
  });
});
