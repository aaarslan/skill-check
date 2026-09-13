export const INPUT_LIMITS = {
  fileBytes: 256 * 1024,
  packageBytes: 2 * 1024 * 1024,
  files: 100,
  lines: 4000,
} as const;

export const TEXT_FILE_PATTERN =
  /\.(md|markdown|txt|json|ya?ml|[cm]?js|[cm]?ts|tsx|jsx|py|sh|ps1|toml|csv|css|html)$/iu;

export interface ReviewSource {
  readonly path: string;
  readonly content: string;
}

/** Normalize transport differences only. Suspicious Unicode remains visible to reviewers. */
export function normalizeContent(content: string): string {
  return content.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
}

export function validateContent(content: string): string {
  if (new TextEncoder().encode(content).length > INPUT_LIMITS.fileBytes)
    throw new Error("Each file must be at most 256 KiB.");
  const normalized = normalizeContent(content);
  if (normalized.includes("\0")) throw new Error("Binary content is not supported.");
  if (normalized.split("\n").length > INPUT_LIMITS.lines)
    throw new Error("Each file must have at most 4,000 lines.");
  return normalized;
}

/** Match the CLI's fatal UTF-8 decoding instead of silently replacing invalid bytes. */
export function decodeUtf8(bytes: AllowSharedBufferSource): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/** Portable, case-sensitive relative package paths. No filesystem or URL access. */
export function normalizePackagePath(path: string): string {
  const normalized = path.normalize("NFC").replace(/\\/gu, "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    /[:?#%]/u.test(normalized) ||
    hasControlCharacter(normalized)
  )
    throw new Error(`Invalid package path: ${path}`);
  const parts = normalized.split("/").filter((part) => part !== ".");
  if (!parts.length || parts.some((part) => !part || part === ".." || /[. ]$/u.test(part)))
    throw new Error(`Invalid package path: ${path}`);
  return parts.join("/");
}

export function hasControlCharacter(value: string): boolean {
  return Array.from(value).some(
    (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
  );
}

export function prepareSources(sources: readonly ReviewSource[]): ReviewSource[] {
  if (!sources.length || sources.length > INPUT_LIMITS.files)
    throw new Error("Choose between 1 and 100 text files.");
  let bytes = 0;
  const paths = new Set<string>();
  return sources
    .map((source) => {
      const path = normalizePackagePath(source.path);
      if (paths.has(path)) throw new Error(`Duplicate package path: ${path}`);
      paths.add(path);
      bytes += new TextEncoder().encode(source.content).length;
      if (bytes > INPUT_LIMITS.packageBytes) throw new Error("The package must be at most 2 MiB.");
      return { path, content: validateContent(source.content) };
    })
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
