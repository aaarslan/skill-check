import { describe, expect, it } from "vite-plus/test";
import { parseFrontmatter } from "./frontmatter.ts";
import { validateSkillDocument, validateSkillPackage } from "./validate.ts";

const good =
  '---\nname: pdf-processing\ndescription: Extract text from PDFs. Use when working with PDF files.\nlicense: Apache-2.0\nmetadata:\n  author: example-org\n  version: "1.0"\n---\n# PDF\n';

describe("parseFrontmatter", () => {
  it("parses fields, quoted values, and metadata", () => {
    const fm = parseFrontmatter(good);
    expect(fm.present).toBe(true);
    expect(fm.closed).toBe(true);
    expect(fm.fields["name"]).toBe("pdf-processing");
    expect(fm.metadata["author"]).toBe("example-org");
    expect(fm.metadata["version"]).toBe("1.0");
  });
  it("parses folded description", () => {
    const fm = parseFrontmatter(
      "---\nname: x\ndescription: >\n  Does things.\n  Use when needed.\n---\nbody",
    );
    expect(fm.fields["description"]).toContain("Does things. Use when needed.");
  });
  it("decodes quoted scalars with trailing comments and keeps hashes inside quotes", () => {
    const fm = parseFrontmatter(
      "---\nname: \"demo\" # directory name\ndescription: 'Use when # tagging.' # note\n---\n",
    );
    expect(fm.fields["name"]).toBe("demo");
    expect(fm.fields["description"]).toBe("Use when # tagging.");
    expect(
      validateSkillDocument(
        '---\nname: "demo" # directory name\ndescription: Helps. Use when demoing.\n---\n',
        "demo/SKILL.md",
      ),
    ).toEqual([]);
  });
  it("checks a root SKILL.md against the selected folder name", () => {
    const doc = "---\nname: demo\ndescription: Helps. Use when demoing.\n---\n# Demo\n";
    expect(validateSkillDocument(doc, "SKILL.md")).toEqual([]);
    expect(
      validateSkillDocument(doc, "SKILL.md", "wrong-name").some(
        (f) => f.ruleId === "spec/name-directory-mismatch",
      ),
    ).toBe(true);
    expect(validateSkillDocument(doc, "SKILL.md", "demo")).toEqual([]);
  });
  it("reports missing frontmatter", () => {
    expect(parseFrontmatter("# Hi\n").present).toBe(false);
  });
});

describe("validateSkillDocument", () => {
  it("accepts a compliant skill", () => {
    expect(validateSkillDocument(good, "pdf-processing/SKILL.md")).toEqual([]);
  });
  it("flags spec invalid names from the specification examples", () => {
    for (const bad of ["PDF-Processing", "-pdf", "pdf--processing"]) {
      const rules = validateSkillDocument(
        `---\nname: ${bad}\ndescription: Helps with PDFs. Use for PDFs.\n---\n`,
        "SKILL.md",
      ).map((f) => f.ruleId);
      expect(rules.some((r) => r.startsWith("spec/name-"))).toBe(true);
    }
  });
  it("flags missing frontmatter, long description, and directory mismatch", () => {
    expect(validateSkillDocument("# x\n", "SKILL.md")[0]?.ruleId).toBe("spec/frontmatter-missing");
    const long = `---\nname: a\ndescription: ${"x ".repeat(600)}Use when x.\n---\n`;
    expect(
      validateSkillDocument(long, "SKILL.md").some((f) => f.ruleId === "spec/description-too-long"),
    ).toBe(true);
    expect(
      validateSkillDocument(good, "other-dir/SKILL.md").some(
        (f) => f.ruleId === "spec/name-directory-mismatch",
      ),
    ).toBe(true);
  });
});

describe("validateSkillPackage", () => {
  it("flags a package with no SKILL.md", () => {
    expect(
      validateSkillPackage([{ path: "notes.md", content: "# n" }]).some(
        (f) => f.ruleId === "spec/skill-md-missing",
      ),
    ).toBe(true);
  });
});
