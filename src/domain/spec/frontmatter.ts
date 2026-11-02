export interface ParsedFrontmatter {
  readonly present: boolean;
  readonly closed: boolean;
  readonly fields: Readonly<Record<string, string>>;
  readonly metadata: Readonly<Record<string, string>>;
  readonly fieldLines: Readonly<Record<string, number>>;
  readonly bodyStartLine: number;
}

const EMPTY: ParsedFrontmatter = {
  present: false,
  closed: false,
  fields: {},
  metadata: {},
  fieldLines: {},
  bodyStartLine: 1,
};

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed.replace(/\s+#.*$/u, "").trim();
}

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const lines = content.split("\n");
  if (!/^---\s*$/u.test(lines[0] ?? "")) return EMPTY;
  const fields: Record<string, string> = {};
  const metadata: Record<string, string> = {};
  const fieldLines: Record<string, number> = {};
  let inMetadata = false;
  let blockKey: string | null = null;
  let blockFolded = true;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^(---|\.\.\.)\s*$/u.test(line)) {
      return { present: true, closed: true, fields, metadata, fieldLines, bodyStartLine: i + 2 };
    }
    if (blockKey && /^\s+\S/u.test(line)) {
      const prior = fields[blockKey] ?? "";
      fields[blockKey] = prior ? `${prior}${blockFolded ? " " : "\n"}${line.trim()}` : line.trim();
      continue;
    }
    blockKey = null;
    if (inMetadata && /^\s+\S/u.test(line)) {
      const m = /^\s+([^:]+):\s*(.*)$/u.exec(line);
      if (m) metadata[(m[1] ?? "").trim()] = unquote(m[2] ?? "");
      continue;
    }
    inMetadata = false;
    const m = /^([A-Za-z][\w-]*):\s*(.*)$/u.exec(line);
    if (!m) continue;
    const key = (m[1] ?? "").toLowerCase();
    const raw = (m[2] ?? "").trim();
    fieldLines[key] = i + 1;
    if (key === "metadata" && raw === "") {
      inMetadata = true;
      continue;
    }
    if (raw === ">" || raw === ">-" || raw === "|" || raw === "|-") {
      blockKey = key;
      blockFolded = raw.startsWith(">");
      fields[key] = "";
      continue;
    }
    fields[key] = unquote(raw);
  }
  return {
    present: true,
    closed: false,
    fields,
    metadata,
    fieldLines,
    bodyStartLine: lines.length + 1,
  };
}
