/** Maps visually-confusable Cyrillic and Greek letters to their Latin lookalikes. */
const CONFUSABLES: Record<string, string> = {
  // Cyrillic lowercase -> Latin
  а: "a",
  е: "e",
  о: "o",
  р: "p",
  с: "c",
  х: "x",
  у: "y",
  і: "i",
  ѕ: "s",
  // Cyrillic uppercase -> Latin
  А: "A",
  В: "B",
  Е: "E",
  К: "K",
  М: "M",
  Н: "H",
  О: "O",
  Р: "P",
  С: "C",
  Т: "T",
  Х: "X",
  У: "Y",
  І: "I",
  // Greek lowercase -> Latin
  ο: "o",
  ν: "v",
  α: "a",
  ρ: "p",
  τ: "t",
  υ: "y",
  κ: "k",
  // Greek uppercase -> Latin
  Ο: "O",
  Ν: "N",
  Α: "A",
  Ρ: "P",
  Τ: "T",
  Υ: "Y",
  Κ: "K",
  Β: "B",
  Χ: "X",
  Ε: "E",
  Ζ: "Z",
  Η: "H",
  Ι: "I",
  Μ: "M",
  // Latin lookalikes outside the Cyrillic/Greek sets above
  ɡ: "g",
  ʁ: "r",
  ɩ: "i",
};

// Matches a run of 4+ single letters each separated by an underscore, hyphen,
// period, or asterisk, e.g. "i-g-n-o-r-e" — a common technique for evading
// literal phrase matching. Deliberately excludes plain spaces from the
// separator class: collapsing spaces would also fuse separate WORDS together
// (e.g. "ignore previous" -> "ignoreprevious"), which breaks matching against
// multi-word patterns instead of defeating obfuscation. As a result, spacing
// out every letter across an entire multi-word phrase ("i g n o r e p r e v
// i o u s") is not caught by this pass — a known, accepted gap.
const SEPARATED_LETTERS_RUN = /\b(?:[a-zA-Z][_.\-*/:+|]){3,}[a-zA-Z]\b/gu;
const SEPARATED_CHUNKS_RUN = /\b(?:[a-zA-Z]{2,8}[-_./]){1,}[a-zA-Z]{2,8}\b/gu;
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t" };

/**
 * Produces a matching-only variant of a line: Unicode-normalized (NFKC),
 * confusable letters mapped to their Latin equivalents, and single-letter
 * separator obfuscation collapsed. The original line is always what's shown
 * to the user; this is only used to detect obfuscated pattern matches.
 */
export function normalizeForMatching(line: string): string {
  // Fast path: plain printable ASCII with no separator-obfuscated or
  // digit-mixed tokens is unchanged by every step below.
  if (!/[^\x20-\x7E]|[A-Za-z][-_./*:+|][A-Za-z]|[A-Za-z]\d|\d[A-Za-z]/u.test(line)) {
    return line;
  }
  const nfkc = line.normalize("NFKC");
  let mapped = "";
  for (const char of nfkc) {
    const code = char.codePointAt(0) ?? 0;
    mapped += (code < 32 && char !== "\n") || code === 127 ? " " : (CONFUSABLES[char] ?? char);
  }
  const leetDecoded = mapped.replace(/[A-Za-z0-9]+/gu, (token) =>
    /[A-Za-z]/u.test(token) && /[0-9]/u.test(token)
      ? token.replace(/[0-9]/gu, (digit) => LEET[digit] ?? digit)
      : token,
  );
  return leetDecoded
    .replace(SEPARATED_LETTERS_RUN, (run) => run.replace(/[_.\-*/:+|]/gu, ""))
    .replace(SEPARATED_CHUNKS_RUN, (run) => run.replace(/[-_./]/gu, ""));
}
