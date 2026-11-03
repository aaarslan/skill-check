export interface ParsedFrontmatter {
  readonly present: boolean;
  readonly closed: boolean;
  readonly fields: Readonly<Record<string, string>>;
  readonly metadata: Readonly<Record<string, string>>;
  readonly fieldLines: Readonly<Record<string, number>>;
  readonly nonStringFields: readonly string[];
  readonly invalidFields: readonly string[];
  readonly duplicateFields: readonly string[];
  readonly bodyStartLine: number;
}

const EMPTY: ParsedFrontmatter = {
  present: false,
  closed: false,
  fields: {},
  metadata: {},
  fieldLines: {},
  nonStringFields: [],
  invalidFields: [],
  duplicateFields: [],
  bodyStartLine: 1,
};

const NON_STRING_SCALAR =
  /^(?:null|~|true|false|yes|no|on|off|[+-]?(?:\d[\d_]*\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)$/iu;
const BLOCK_HEADER = /^([>|])(?:[+-]?\d?|\d[+-]?)?\s*(?:#.*)?$/u;

function decodeDoubleQuoted(inner: string): string {
  return inner.replace(
    /\\(?:u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|n|t|r|0|\\|"|\/|.)/gu,
    (whole, unicode: string | undefined, hex: string | undefined) => {
      if (unicode) return String.fromCharCode(parseInt(unicode, 16));
      if (hex) return String.fromCharCode(parseInt(hex, 16));
      switch (whole.slice(1)) {
        case "n":
          return "\n";
        case "t":
          return "\t";
        case "r":
          return "\r";
        case "0":
          return "\0";
        default:
          return whole.slice(1);
      }
    },
  );
}

function findClosingQuote(value: string, quote: string): number {
  let index = 1;
  while (index < value.length) {
    if (quote === '"' && value[index] === "\\") {
      index += 2;
      continue;
    }
    if (value[index] === quote) {
      if (quote === "'" && value[index + 1] === "'") {
        index += 2;
        continue;
      }
      return index;
    }
    index++;
  }
  return -1;
}

function unquote(value: string): { value: string; invalid: boolean } {
  const trimmed = value.trim();
  const quote = trimmed.startsWith('"') ? '"' : trimmed.startsWith("'") ? "'" : null;
  if (quote) {
    const close = findClosingQuote(trimmed, quote);
    if (close < 0) return { value: trimmed.slice(1), invalid: true };
    const rest = trimmed.slice(close + 1).trim();
    const invalid = rest !== "" && !rest.startsWith("#");
    const inner = trimmed.slice(1, close);
    return {
      value: quote === "'" ? inner.replace(/''/gu, "'") : decodeDoubleQuoted(inner),
      invalid,
    };
  }
  return { value: trimmed.replace(/\s+#.*$/u, "").trim(), invalid: false };
}

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const lines = content
    .replace(/^\uFEFF/u, "")
    .split("\n")
    .map((line) => line.replace(/\r$/u, ""));
  if (!/^---\s*$/u.test(lines[0] ?? "")) return EMPTY;
  const fields: Record<string, string> = {};
  const metadata: Record<string, string> = {};
  const fieldLines: Record<string, number> = {};
  let inMetadata = false;
  let blockKey: string | null = null;
  let blockFolded = true;
  let pendingBlanks = 0;
  let plainKey: string | null = null;
  let pendingQuote: { key: string; quote: string; text: string } | null = null;
  const nonStringFields: string[] = [];
  const invalidFields: string[] = [];
  const duplicateFields: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^(---|\.\.\.)\s*$/u.test(line)) {
      if (pendingQuote && !invalidFields.includes(pendingQuote.key)) {
        invalidFields.push(pendingQuote.key);
      }
      return {
        present: true,
        closed: true,
        fields,
        metadata,
        fieldLines,
        nonStringFields,
        invalidFields,
        duplicateFields,
        bodyStartLine: i + 2,
      };
    }
    if (pendingQuote) {
      pendingQuote.text += ` ${line.trim()}`;
      if (findClosingQuote(pendingQuote.text, pendingQuote.quote) >= 0) {
        const decoded = unquote(pendingQuote.text);
        fields[pendingQuote.key] = decoded.value;
        if (decoded.invalid) invalidFields.push(pendingQuote.key);
        pendingQuote = null;
      }
      continue;
    }
    if (blockKey) {
      if (line.trim() === "") {
        pendingBlanks++;
        continue;
      }
      if (/^\s+\S/u.test(line)) {
        const prior = fields[blockKey] ?? "";
        if (!prior) {
          fields[blockKey] = line.trim();
        } else {
          const separator =
            pendingBlanks > 0
              ? "\n".repeat(blockFolded ? pendingBlanks : pendingBlanks + 1)
              : blockFolded
                ? " "
                : "\n";
          fields[blockKey] = `${prior}${separator}${line.trim()}`;
        }
        pendingBlanks = 0;
        continue;
      }
      blockKey = null;
      pendingBlanks = 0;
    }
    if (line.trim().startsWith("#")) {
      continue;
    }
    if (inMetadata && /^\s+\S/u.test(line)) {
      const m = /^\s+([^:]+):\s*(.*)$/u.exec(line);
      if (m) {
        const metaKey = (m[1] ?? "").trim();
        const metaRaw = (m[2] ?? "").trim();
        const decoded = unquote(metaRaw);
        metadata[metaKey] = decoded.value;
        const metaQuoted = metaRaw.startsWith('"') || metaRaw.startsWith("'");
        if (
          metaKey &&
          ((!metaQuoted && NON_STRING_SCALAR.test(decoded.value) && decoded.value !== "") ||
            metaRaw.startsWith("[") ||
            metaRaw.startsWith("{"))
        ) {
          nonStringFields.push(`metadata.${metaKey}`);
        }
        if (decoded.invalid) invalidFields.push(`metadata.${metaKey}`);
      }
      continue;
    }
    if (inMetadata && line.trim() === "") {
      continue;
    }
    inMetadata = false;
    if (plainKey && /^\s+\S/u.test(line)) {
      const prior = fields[plainKey] ?? "";
      const appended = line
        .trim()
        .replace(/\s+#.*$/u, "")
        .trim();
      fields[plainKey] = prior ? `${prior} ${appended}` : appended;
      continue;
    }
    plainKey = null;
    const m = /^(?:"([^"]+)"|'([^']+)'|([A-Za-z][\w-]*))\s*:\s*(.*)$/u.exec(line);
    if (!m) continue;
    const key = m[1] ?? m[2] ?? m[3] ?? "";
    let rawValue = (m[4] ?? "").trim();
    if (key in fieldLines && !duplicateFields.includes(key)) duplicateFields.push(key);
    if (rawValue.startsWith("*")) {
      fields[key] = rawValue;
      if (!invalidFields.includes(key)) invalidFields.push(key);
      fieldLines[key] = i + 1;
      plainKey = null;
      continue;
    }
    const anchorOrTag = /^(?:&[\w-]+|!{1,2}[\w/-]+)\s+/u.exec(rawValue);
    if (anchorOrTag) rawValue = rawValue.slice(anchorOrTag[0].length).trim();
    const raw = rawValue.startsWith("#") ? "" : rawValue;
    fieldLines[key] = i + 1;
    if (key === "metadata" && raw === "") {
      inMetadata = true;
      continue;
    }
    const blockHeader = BLOCK_HEADER.exec(raw);
    if (blockHeader) {
      blockKey = key;
      blockFolded = blockHeader[1] === ">";
      pendingBlanks = 0;
      fields[key] = "";
      continue;
    }
    const quote = raw.startsWith('"') ? '"' : raw.startsWith("'") ? "'" : null;
    if (quote && findClosingQuote(raw, quote) < 0) {
      pendingQuote = { key, quote, text: raw };
      fields[key] = "";
      continue;
    }
    const decoded = unquote(raw);
    fields[key] = decoded.value;
    if (decoded.invalid) invalidFields.push(key);
    if (
      !quote &&
      (NON_STRING_SCALAR.test(decoded.value) ||
        decoded.value.startsWith("[") ||
        decoded.value.startsWith("{"))
    )
      nonStringFields.push(key);
    if (raw === "" && !quote && key !== "metadata") {
      let next = i + 1;
      while (next < lines.length) {
        const peeked = lines[next] ?? "";
        if (peeked.trim() === "" || peeked.trim().startsWith("#")) {
          next++;
          continue;
        }
        break;
      }
      const peeked = lines[next] ?? "";
      if (
        /^\s+\S/u.test(peeked) &&
        (/^\s+-(?:\s|$)/u.test(peeked) ||
          /^\s+(?:"[^"]+"|'[^']+'|[A-Za-z][\w-]*)\s*:/u.test(peeked))
      ) {
        nonStringFields.push(key);
        fields[key] = "";
        plainKey = null;
        let end = next;
        while (end < lines.length) {
          const consumed = lines[end] ?? "";
          if (/^(---|\.\.\.)\s*$/u.test(consumed)) break;
          if (consumed.trim() === "" || consumed.trim().startsWith("#")) {
            end++;
            continue;
          }
          if (/^\s+\S/u.test(consumed)) {
            end++;
            continue;
          }
          break;
        }
        i = end - 1;
        continue;
      }
    }
    plainKey = quote ? null : key;
  }
  return {
    present: true,
    closed: false,
    fields,
    metadata,
    fieldLines,
    nonStringFields,
    invalidFields,
    duplicateFields,
    bodyStartLine: lines.length + 1,
  };
}
