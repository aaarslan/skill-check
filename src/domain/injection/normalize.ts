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
};

// Matches a run of 4+ single letters each separated by an underscore, hyphen,
// period, or asterisk, e.g. "i-g-n-o-r-e" — a common technique for evading
// literal phrase matching. Deliberately excludes plain spaces from the
// separator class: collapsing spaces would also fuse separate WORDS together
// (e.g. "ignore previous" -> "ignoreprevious"), which breaks matching against
// multi-word patterns instead of defeating obfuscation. As a result, spacing
// out every letter across an entire multi-word phrase ("i g n o r e p r e v
// i o u s") is not caught by this pass — a known, accepted gap.
const SEPARATED_LETTERS_RUN = /\b(?:[a-zA-Z][_.\-*]){3,}[a-zA-Z]\b/gu;

/**
 * Produces a matching-only variant of a line: Unicode-normalized (NFKC),
 * confusable letters mapped to their Latin equivalents, and single-letter
 * separator obfuscation collapsed. The original line is always what's shown
 * to the user; this is only used to detect obfuscated pattern matches.
 */
export function normalizeForMatching(line: string): string {
  const nfkc = line.normalize("NFKC");
  let mapped = "";
  for (const char of nfkc) {
    mapped += CONFUSABLES[char] ?? char;
  }
  return mapped.replace(SEPARATED_LETTERS_RUN, (run) => run.replace(/[_.\-*]/gu, ""));
}
