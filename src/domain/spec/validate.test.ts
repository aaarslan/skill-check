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

describe("frontmatter scalar edge cases", () => {
  it("keeps block scalar paragraphs across blank lines for length checks", () => {
    const content = `---\nname: demo\ndescription: >\n  Use when demoing.\n\n  ${"x ".repeat(600)}\n---\n`;
    expect(parseFrontmatter(content).fields["description"]?.length).toBeGreaterThan(1024);
    expect(
      validateSkillDocument(content, "SKILL.md").some(
        (f) => f.ruleId === "spec/description-too-long",
      ),
    ).toBe(true);
    const literal = parseFrontmatter("---\nname: d\ndescription: |\n  one\n\n  two\n---\n");
    expect(literal.fields["description"]).toBe("one\n\ntwo");
  });
  it("joins plain and quoted multiline scalars", () => {
    const plain = parseFrontmatter(
      "---\nname: demo\ndescription: Helps with demos\n  and examples. Use when needed.\n---\n",
    );
    expect(plain.fields["description"]).toBe("Helps with demos and examples. Use when needed.");
    const quoted = parseFrontmatter(
      '---\nname: demo\ndescription: "Helps with demos.\n  Use when needed."\n---\n',
    );
    expect(quoted.fields["description"]).toBe("Helps with demos. Use when needed.");
  });
  it("treats frontmatter keys as case-sensitive", () => {
    const rules = validateSkillDocument(
      "---\nName: demo\ndescription: Helps. Use when demoing.\n---\n",
      "SKILL.md",
    ).map((f) => f.ruleId);
    expect(rules).toContain("spec/name-missing");
    expect(rules).toContain("spec/unknown-field");
  });
});

describe("YAML scalar fidelity", () => {
  it("recognizes block header variants with chomping, indent, and comments", () => {
    for (const header of [">+", "|+", ">2", "> # fold", ">-2"]) {
      const fm = parseFrontmatter(
        `---\nname: demo\ndescription: ${header}\n  Use when demoing.\n---\n`,
      );
      expect(fm.fields["description"]).toBe("Use when demoing.");
    }
    const long = `---\nname: demo\ndescription: >+\n  Use when demoing. ${"x ".repeat(600)}\n---\n`;
    expect(
      validateSkillDocument(long, "SKILL.md").some((f) => f.ruleId === "spec/description-too-long"),
    ).toBe(true);
  });
  it("flags non-string YAML scalars for name and description", () => {
    for (const bad of ["null", "true", "123", "yes"]) {
      const rules = validateSkillDocument(
        `---\nname: ${bad}\ndescription: Helps. Use when demoing.\n---\n`,
        "SKILL.md",
      ).map((f) => f.ruleId);
      expect(rules).toContain("spec/non-string-field");
      expect(rules).not.toContain("spec/name-missing");
    }
    expect(
      validateSkillDocument(
        '---\nname: "123"\ndescription: Helps. Use when demoing.\n---\n',
        "SKILL.md",
      ).some((f) => f.ruleId === "spec/non-string-field"),
    ).toBe(false);
  });
  it("accepts spaced and quoted keys", () => {
    expect(parseFrontmatter("---\nname : demo\n---\n").fields["name"]).toBe("demo");
    expect(parseFrontmatter('---\n"name": demo\n---\n').fields["name"]).toBe("demo");
  });
  it("decodes double-quoted escapes and flags trailing garbage", () => {
    expect(parseFrontmatter('---\nname: "a\\u0062c"\n---\n').fields["name"]).toBe("abc");
    const rules = validateSkillDocument(
      '---\nname: "demo"garbage\ndescription: Helps. Use when demoing.\n---\n',
      "SKILL.md",
    ).map((f) => f.ruleId);
    expect(rules).toContain("spec/frontmatter-invalid");
  });
  it("counts characters as code points, not UTF-16 units", () => {
    const desc = `${"😀".repeat(600)} Use when demoing.`;
    const rules = validateSkillDocument(
      `---\nname: demo\ndescription: ${desc}\n---\n`,
      "SKILL.md",
    ).map((f) => f.ruleId);
    expect(rules).not.toContain("spec/description-too-long");
  });
});

describe("YAML collections in string fields", () => {
  it("flags flow collections as non-string fields", () => {
    for (const description of ["[Use, when, demoing]", "{a: b}"]) {
      const rules = validateSkillDocument(
        `---\nname: demo\ndescription: ${description}\n---\n`,
        "SKILL.md",
      ).map((f) => f.ruleId);
      expect(rules).toContain("spec/non-string-field");
    }
    expect(
      validateSkillDocument(
        "---\nname: [demo]\ndescription: Helps. Use when demoing.\n---\n",
        "SKILL.md",
      ).map((f) => f.ruleId),
    ).toContain("spec/non-string-field");
  });
  it("flags block collections without leaking items into the field", () => {
    const sequence = "---\nname: demo\ndescription:\n  - Use when demoing\n---\n";
    const parsedSequence = parseFrontmatter(sequence);
    expect(parsedSequence.nonStringFields).toContain("description");
    expect(parsedSequence.fields["description"] ?? "").not.toContain("Use when demoing");
    expect(validateSkillDocument(sequence, "SKILL.md").map((f) => f.ruleId)).toContain(
      "spec/non-string-field",
    );
    const mapping = "---\nname: demo\ndescription:\n  trigger: Use when demoing\n---\n";
    expect(parseFrontmatter(mapping).nonStringFields).toContain("description");
    expect(validateSkillDocument(mapping, "SKILL.md").map((f) => f.ruleId)).toContain(
      "spec/non-string-field",
    );
  });
});

describe("YAML comments in frontmatter", () => {
  it("ignores an indented comment after a scalar field", () => {
    const doc =
      "---\nname: demo\n  # Human-readable name\ndescription: Helps. Use when demoing.\n---\n";
    expect(parseFrontmatter(doc).fields["name"]).toBe("demo");
    expect(validateSkillDocument(doc, "demo/SKILL.md")).toEqual([]);
  });
  it("joins plain-scalar continuations across comment-only lines", () => {
    expect(
      parseFrontmatter(
        "---\nname: demo\ndescription: Helps with demos\n  # why this matters\n  and examples. Use when needed.\n---\n",
      ).fields["description"],
    ).toBe("Helps with demos and examples. Use when needed.");
    expect(
      parseFrontmatter(
        "---\nname: demo\ndescription: Helps with demos\n  and examples. Use when needed. # note\n---\n",
      ).fields["description"],
    ).toBe("Helps with demos and examples. Use when needed.");
  });
  it("preserves comment lines inside literal block scalars", () => {
    expect(
      parseFrontmatter(
        "---\nname: demo\ndescription: |\n  Use when demoing.\n  # why this matters\n  Second line.\n---\n",
      ).fields["description"],
    ).toContain("# why this matters");
  });
});

describe("comment-only field values", () => {
  it("treats a value that is only a comment as empty and joins the continuation", () => {
    const fm = parseFrontmatter(
      "---\nname: demo\ndescription: # what it does\n  Helps out. Use when demoing.\n---\n",
    );
    expect(fm.fields["description"]).toBe("Helps out. Use when demoing.");
  });
});

describe("spec fidelity (bug hunt)", () => {
  it("accepts unicode lowercase names", () => {
    expect(
      validateSkillDocument(
        "---\nname: café-data\ndescription: Helps. Use when demoing.\n---\n",
        "café-data/SKILL.md",
      ),
    ).toEqual([]);
  });
  it("flags non-string license, compatibility, allowed-tools, and metadata values", () => {
    const base = "---\nname: demo\ndescription: Helps. Use when demoing.\n";
    for (const extra of [
      "license: 123\n",
      "compatibility: true\n",
      "allowed-tools: [Read, Bash]\n",
      "metadata:\n  version: 1.0\n",
    ]) {
      const rules = validateSkillDocument(`${base}${extra}---\n`, "SKILL.md").map((f) => f.ruleId);
      expect(rules).toContain("spec/non-string-field");
    }
  });
  it("flags duplicate keys, unterminated quotes, aliases; strips anchors", () => {
    expect(
      validateSkillDocument(
        "---\nname: demo\nname: other\ndescription: Helps. Use when demoing.\n---\n",
        "SKILL.md",
      ).map((f) => f.ruleId),
    ).toContain("spec/duplicate-field");
    expect(
      validateSkillDocument(
        '---\nname: "oops\ndescription: Helps. Use when demoing.\n---\nbody\n',
        "SKILL.md",
      ).map((f) => f.ruleId),
    ).toContain("spec/frontmatter-invalid");
    expect(
      validateSkillDocument("---\nname: demo\ndescription: *elsewhere\n---\n", "SKILL.md").map(
        (f) => f.ruleId,
      ),
    ).toContain("spec/frontmatter-invalid");
    expect(parseFrontmatter("---\nname: &n demo\n---\n").fields["name"]).toBe("demo");
  });
  it("distinguishes present-but-empty from missing", () => {
    const rules = validateSkillDocument(
      '---\nname: ""\ndescription: Helps. Use when demoing.\n---\n',
      "SKILL.md",
    ).map((f) => f.ruleId);
    expect(rules).toContain("spec/empty-field");
    expect(rules).not.toContain("spec/name-missing");
  });
});

describe("explicit YAML tags (review round 4)", () => {
  it("treats !!str values as strings even when they look numeric", () => {
    expect(
      validateSkillDocument(
        "---\nname: !!str 123\ndescription: Helps. Use when demoing.\n---\n",
        "123/SKILL.md",
      ),
    ).toEqual([]);
    expect(parseFrontmatter("---\nname: !!str 123\n---\n").fields["name"]).toBe("123");
    expect(
      validateSkillDocument(
        "---\nname: !!int 123\ndescription: Helps. Use when demoing.\n---\n",
        "SKILL.md",
      ).map((f) => f.ruleId),
    ).toContain("spec/non-string-field");
    expect(
      parseFrontmatter("---\nname: !<tag:yaml.org,2002:str> 42\n---\n").nonStringFields,
    ).toEqual([]);
  });
});
