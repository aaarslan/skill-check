import type { FindingLocation, Severity } from "../shared/types.ts";
import { parseFrontmatter } from "./frontmatter.ts";

export interface SpecFinding {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly message: string;
  readonly explanation: string;
  readonly suggestion: string;
  readonly location: FindingLocation | null;
}

const KNOWN_FIELDS = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
]);

function finding(
  rule: string,
  severity: Severity,
  message: string,
  suggestion: string,
  line: number | null,
  excerpt = "",
): SpecFinding {
  return {
    ruleId: `spec/${rule}`,
    severity,
    message,
    explanation:
      "Checked against the Agent Skills specification (agentskills.io/specification). Loaders may reject or misload non-compliant skills.",
    suggestion,
    location: line === null ? null : { line, excerpt },
  };
}

export function isSkillDocumentPath(path: string | null): boolean {
  if (!path) return true;
  return /(^|\/)SKILL\.md$/u.test(path) || /\.(md|markdown)$/iu.test(path);
}

export function validateSkillDocument(content: string, path: string | null): SpecFinding[] {
  const out: SpecFinding[] = [];
  const fm = parseFrontmatter(content);
  const lineOf = (key: string) => fm.fieldLines[key] ?? 1;
  if (!fm.present) {
    out.push(
      finding(
        "frontmatter-missing",
        "high",
        "SKILL.md has no YAML frontmatter",
        "Start the file with a --- block containing at least name: and description:.",
        1,
        (content.split("\n")[0] ?? "").slice(0, 80),
      ),
    );
    return out;
  }
  if (!fm.closed) {
    out.push(
      finding(
        "frontmatter-unclosed",
        "high",
        "YAML frontmatter is not closed with ---",
        "Add a closing --- line after the frontmatter fields.",
        1,
      ),
    );
  }
  const name = fm.fields["name"];
  if (!name) {
    out.push(
      finding(
        "name-missing",
        "high",
        "Frontmatter has no name field",
        "Add name: with the skill directory name.",
        1,
      ),
    );
  } else {
    if (name.length > 64)
      out.push(
        finding(
          "name-too-long",
          "high",
          `Skill name is ${name.length} characters (max 64)`,
          "Shorten the name to 64 characters or fewer.",
          lineOf("name"),
          name.slice(0, 80),
        ),
      );
    if (!/^[a-z0-9-]+$/u.test(name))
      out.push(
        finding(
          "name-charset",
          "high",
          "Skill name must use only lowercase letters, numbers, and hyphens",
          "Rename using lowercase a-z, 0-9, and hyphens only.",
          lineOf("name"),
          name.slice(0, 80),
        ),
      );
    if (name.startsWith("-") || name.endsWith("-"))
      out.push(
        finding(
          "name-hyphen-edge",
          "high",
          "Skill name must not start or end with a hyphen",
          "Remove the leading or trailing hyphen.",
          lineOf("name"),
          name,
        ),
      );
    if (name.includes("--"))
      out.push(
        finding(
          "name-consecutive-hyphens",
          "high",
          "Skill name must not contain consecutive hyphens",
          "Replace -- with a single hyphen.",
          lineOf("name"),
          name,
        ),
      );
    const parent = path?.split("/").slice(-2, -1)[0];
    const isWrapper = parent === "original" || parent === "candidate";
    if (parent && !isWrapper && /(^|\/)SKILL\.md$/u.test(path ?? "") && parent !== name)
      out.push(
        finding(
          "name-directory-mismatch",
          "medium",
          `Skill name "${name}" does not match its directory "${parent}"`,
          "Rename the directory or the name field so they match.",
          lineOf("name"),
          name,
        ),
      );
  }
  const description = fm.fields["description"];
  if (!description) {
    out.push(
      finding(
        "description-missing",
        "high",
        "Frontmatter has no description field",
        "Add description: stating what the skill does and when to use it.",
        1,
      ),
    );
  } else {
    if (description.length > 1024)
      out.push(
        finding(
          "description-too-long",
          "high",
          `Description is ${description.length} characters (max 1024)`,
          "Trim the description to 1024 characters or fewer; move detail into the body.",
          lineOf("description"),
          description.slice(0, 80),
        ),
      );
    if (!/\b(use|when|for)\b/iu.test(description))
      out.push(
        finding(
          "description-no-trigger",
          "low",
          "Description does not say when to use the skill",
          "Add a when-to-use clause with trigger keywords agents can match.",
          lineOf("description"),
          description.slice(0, 80),
        ),
      );
  }
  const compatibility = fm.fields["compatibility"];
  if (compatibility !== undefined && (compatibility.length === 0 || compatibility.length > 500))
    out.push(
      finding(
        "compatibility-length",
        "medium",
        "Compatibility must be 1-500 characters when present",
        "Shorten compatibility or remove it if there are no environment requirements.",
        lineOf("compatibility"),
        compatibility.slice(0, 80),
      ),
    );
  for (const key of Object.keys(fm.fields)) {
    if (!KNOWN_FIELDS.has(key))
      out.push(
        finding(
          "unknown-field",
          "info",
          `Unknown frontmatter field "${key}" may be ignored by loaders`,
          "Move custom values under metadata: or check the field spelling.",
          lineOf(key),
          key,
        ),
      );
  }
  const lineCount = content.split("\n").length;
  if (lineCount > 500)
    out.push(
      finding(
        "body-very-long",
        "low",
        `SKILL.md is ${lineCount} lines; long bodies load fully on activation`,
        "Move detailed material into references/ files linked one level deep (progressive disclosure).",
        null,
      ),
    );
  return out;
}

export function validateSkillPackage(
  sources: readonly { readonly path: string; readonly content: string }[],
): SpecFinding[] {
  const out: SpecFinding[] = [];
  const skillFiles = sources.filter((s) => /(^|\/)SKILL\.md$/u.test(s.path));
  if (skillFiles.length === 0)
    out.push(
      finding(
        "skill-md-missing",
        "high",
        "Package has no SKILL.md at its root or in a skill directory",
        "Add a SKILL.md with YAML frontmatter; it is the required entry point.",
        null,
      ),
    );
  if (skillFiles.length > 1)
    out.push(
      finding(
        "multiple-skill-md",
        "low",
        `Package contains ${skillFiles.length} SKILL.md files; loaders treat each directory as a separate skill`,
        "Confirm each SKILL.md is an intentionally separate skill.",
        null,
      ),
    );
  for (const s of sources) {
    if (/\.(exe|dll|so|dylib|bin|zip|tar|gz)$/iu.test(s.path))
      out.push(
        finding(
          "binary-asset",
          "info",
          `Binary-looking file "${s.path}" cannot be reviewed as text`,
          "Keep binaries in assets/ only when required and document their provenance.",
          null,
        ),
      );
  }
  return out;
}
