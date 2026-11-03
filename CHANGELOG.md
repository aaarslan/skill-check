# Changelog

## 1.1.0 - 2026-11-02

### Added

- Light color scheme honoring `prefers-color-scheme`: the hardcoded dark
  palette was variable-ified by role, and both schemes are screenshot-verified
  in the browser test suite.
- Web Worker analysis (`analysisWorker`) shared by single, compare, and
  folder modes, with an exact synchronous fallback when Workers are
  unavailable or fail.
- Real-browser Playwright suite (system Chrome) covering all three modes,
  both color schemes with screenshots, and a mobile viewport:
  `pnpm test:browser`.

### Changed

- `App.tsx` split into `ModePicker` and `ResultsSection` components; App now
  owns only header, disclaimer, mode state, and file inputs.
- The published `skillcheck` binary is now a bundled JavaScript file
  (`dist-cli/`, built by `pnpm build:cli` on pack) so it runs when installed
  under `node_modules`, where Node cannot strip TypeScript.

### Fixed (PR review)

- Decision import verifies source text and finding identity, refusing
  decisions from changed documents.
- Quoted frontmatter scalars with trailing comments decode correctly.
- Diff change navigation scrolls after windowed rows expand.
- Root SKILL.md name checks use the selected folder name (CLI and browser).
- SARIF artifact URIs map to the real reviewed files.
- Fourth review round: explicit YAML string tags (`!!str`) are honored
  instead of inferring type from the remaining text, and indented-code
  detection is list-relative so list continuation paragraphs stay prose.
- Pre-review bug hunt (four adversarial passes): control-character and
  chunked/leetspeak evasion in normalization, duplicate finding ids,
  cross-line coverage for impersonation/secret/scope/data exfiltration,
  trailing HTML-comment quadratic, closed-ATX/setext/unicode heading slugs,
  fence closing rules and indented code blocks, same-line contradictions,
  query-bearing cross-file links, duplicate/alias frontmatter keys,
  folder reviews skip hidden/dependency/non-text entries instead of
  aborting, CLI argument forms (`--`, `--flag=value`, last-wins gates),
  output-in-folder refusal, empty-stdin refusal, failed loads preserving
  the last good analysis, diff navigation reset, and signature-deduped
  re-analysis.
- Third review round: YAML collections in string fields and standalone
  comment lines in frontmatter; the `rm` flag regexes replaced with a linear
  single-pass tokenizer (the remaining quadratic case).
- Second review round: quadratic-time patterns on adversarial 256 KiB inputs
  (pipe-to-shell, bracket/link scans, per-match context checks, HTML comments)
  are bounded and covered by performance regression tests; YAML block-scalar
  variants, quoted/spaced keys, non-string scalars, escapes, and code-point
  length counting; invisible-Unicode findings respect quoted context;
  lowercase fake delimiters and split/long-form `rm` flags; strict `--config`
  validation; region-free SARIF locations for document-level findings;
  root-folder context preserved across in-package edits; diff navigation
  re-scrolls to the same group and keeps focus on expand; worker analysis is
  stale-while-revalidate with supersede/timeout handling; decision import
  reports success and failure; lazy panels fail in place.

## 1.0.0 - 2026-11-02

First numbered release. Report schema 1.1, rules 2026.11.02.1, corpus synthetic-2.0.

### Added

- Agent Skills spec compliance: bounded YAML frontmatter parser and `spec/*`
  findings for name, description, compatibility, unknown fields, directory
  match, SKILL.md presence, and progressive-disclosure length. New Spec
  compliance tab and package-level findings in folder review.
- SARIF 2.1.0 export in the browser and via `--format sarif`.
- Decision import: reopen decisions from any 1.x JSON report.
- CLI: `--stdin`, `--fail-on high|medium`, `--config`, installable
  `skillcheck` binary, Node >= 22.18 engine declaration.
- Calibration held-out split: corpus grows from 21 to 63 cases, the table
  reports held-out rates, and split counts ship in calibration JSON.
- Detection coverage for role reassignment and claimed system messages,
  bracketed role delimiters, destructive and pipe-to-shell commands,
  conversation exfiltration to endpoints and tracking pixels, out-of-scope
  filesystem access, and invisible Unicode tag/bidi/zero-width smuggling.
- Error boundary, lazy Diff/folder/calibration chunks, deferred analysis,
  600-row diff windowing with show-all, persistent disclaimer dismissal,
  CSP/OpenGraph metadata, and a web app manifest.
- Coverage thresholds with V8 provider, seeded diff property tests, an axe
  accessibility test, and a build/preview/fetch E2E smoke test.

### Changed

- Toolchain: Vite+ 1.4, TypeScript 7, React 19.3, jsdom 30,
  Testing Library current. The CLI's TypeScript-stripping path is verified
  unchanged by the browser/CLI parity test.
- Report schema 1.0 to 1.1 (additive: per-document and package `spec`).
  Quality scores are intentionally unaffected by spec findings.

### Known limitations carried forward

- Calibration is still author-labeled, synthetic, and not independently
  adjudicated. Held-out miss rates (for example alternate override phrasings)
  are reported, not tuned away.
- (Resolved in 1.1.0: light theme and Web Worker analysis.)
