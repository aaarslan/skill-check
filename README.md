# Skillcheck

Review one skill file, compare revisions, or inspect a local skill folder with
a structural **diff**, deterministic **quality scoring**, and heuristic
**prompt-injection detection**. Start with built-in synthetic examples, edit
the source, record review decisions, and export versioned JSON or Markdown.
Analysis runs locally in the browser or through the matching Node CLI. Source
text is held in memory unless you explicitly export a report; it is not uploaded.

<p>
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149eca">
  <img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178c6">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-green">
</p>

---

## Disclaimer

Skillcheck is an analysis aid, not an authority.

- **Quality scores are heuristic.** They come from transparent, deterministic
  rules that reward good structure and clear instructions. A high score is a
  signal, not a guarantee of a good skill, and a low score is a prompt to look
  closer, not a verdict.
- **Injection detection is heuristic.** Pattern matching cannot prove or
  exclude prompt injection. Skillcheck surfaces suspicious patterns for a human
  to review. It will miss novel attacks and will occasionally flag benign text.
  Never treat a clean result as a safety clearance.
- **You are the reviewer.** Use the findings to focus your own judgment. Do not
  hand a skill file to a production model on the strength of Skillcheck alone.

The software is provided "as is", without warranty of any kind. See
[LICENSE](LICENSE).

---

## What it does

Choose **Review one file**, **Compare revisions**, or **Review folder**. Upload,
drop, paste, or try a built-in example. The one-file flow can create an editable
candidate while preserving the original. Apply edits to rerun the analysis.

### 1. Diff

- Unified and side-by-side layouts.
- Myers O(ND) line diff with an optional "ignore whitespace" mode. Large changes
  fall back to a labeled whole-file replacement when the trace budget is exceeded.
- Keyboard navigation that jumps between changed regions.

### 2. Quality score

A deterministic 0 to 100 score per file, broken down by dimension:

| Dimension     | What it looks at                                              |
| ------------- | ------------------------------------------------------------- |
| Purpose       | Whether the skill states a clear, single purpose up front.    |
| Structure     | Headings, sections, and overall document shape.               |
| Actionability | Concrete, followable instructions rather than vague guidance. |
| Consistency   | Internal agreement: naming, terminology, and formatting.      |
| Integrity     | Broken links, dangling references, and structural defects.    |

When both files are loaded, a comparison summary shows how each dimension moved
from Original to Candidate.

### 3. Prompt-injection findings

Every line is scanned against ten categories of known injection patterns:

`instruction-override`, `impersonation`, `secret-exfiltration`,
`data-exfiltration`, `system-command`, `safety-disable`, `scope-violation`,
`encoded-payload`, `fake-delimiter`, `hidden-content`.

To reduce noise, the detector:

- Normalizes confusable characters (NFKC, plus Cyrillic and Greek lookalikes to
  Latin) so `іgnore` does not slip past a scan for `ignore`.
- Downgrades matches that appear inside quoted or clearly descriptive context.
- Dampens repeated hits within a single category so one noisy file does not
  drown the signal.

Each finding carries a suspicion level (high, medium, low) and can be dismissed
as you triage.

### 4. Folder review and portable reports

Select a folder containing SKILL.md, Markdown references, and supported text
scripts. Every selected file is scanned as inert text. Inline and full/collapsed
reference Markdown links outside fenced blocks are resolved within that selection,
including relative parent paths, encoded spaces, and heading fragments. Missing
files, broken anchors, undefined references, and escaping paths become findings.
Revision comparisons keep files independent; only folder review resolves package links.

Limits apply equally to browser and CLI analysis: **100 files, 256 KiB and 4,000
lines per file, 2 MiB total**. BOM and CRLF/CR are normalized; suspicious Unicode
stays visible. Paths are relative, NFC-normalized, and case-sensitive. Duplicate
paths, traversal, absolute paths, control characters, query/fragment markers, and
percent signs in package filenames are rejected. CLI folder traversal rejects
symlinks, more than 500 directory entries, and depth over 20.

Supported extensions: `.md`, `.markdown`, `.txt`, `.json`, `.yaml`, `.yml`, `.js`,
`.mjs`, `.cjs`, `.ts`, `.mts`, `.cts`, `.tsx`, `.jsx`, `.py`, `.sh`, `.ps1`, `.toml`,
`.csv`, `.css`, `.html`. Binary assets and archives are rejected; select a small
text-only skill folder. No archive extraction, script execution, external link
fetching, dynamic import resolution, or behavioral evaluation occurs. Plain-text
paths, shorthand Markdown references, and non-text dependencies are not resolved.

The **Review findings and keep a record** panel records open/reviewed/dismissed
decisions and notes. Decisions do not alter scores and reset when analyzed text
changes. Exports contain applied content only. JSON schema `1.0` includes normalized
source, complete analysis, rule version, limitations, and decisions; Markdown is
a readable summary without source text. Review exported text before sharing it.
Comparison reports include a line diff with whitespace significant, independent
of display filters. Injection-panel dismissals and report decisions share state.

### 5. Inspectable calibration

The app includes 21 author-labeled synthetic cases (`synthetic-1.0`) covering all
ten categories, benign guidance, quoted examples, and obfuscation. Expand
**Inspect calibration** for source text, label rationale, predictions, false
positives, and misses. A positive prediction means medium or high suspicion;
metrics are per document/category. False-positive rates use negative examples;
miss rates use positive examples. Zero denominators are unavailable, not zero.

This corpus was used during development. It is small, not held out, not independently
adjudicated, and not representative of real-world prevalence. Its recorded mistakes
are intentionally visible. It does not measure skill effectiveness or establish
safety. See `src/domain/calibration/fixtures.ts` and reproduce with `pnpm calibrate`.

### Privacy

There is no analysis backend. Selected content is not transmitted. The browser
loads the application assets; parsing, scoring, and scanning run locally. The
CLI does not make network requests. Reports are written only when you export them.

---

## Quick start

Requires [Node.js](https://nodejs.org) 22.18+ and [pnpm](https://pnpm.io) 11+.

```bash
pnpm install     # install dependencies
pnpm dev         # start the dev server, then open the printed URL
```

Then load two Markdown skill files in the browser and read the diff, scores,
and findings.

### Local CLI and optional CI gate

The CLI imports the same pure `analyzeReview` entrypoint as the browser. It needs
Node's built-in TypeScript stripping (22.18+), with no model/API credentials or
runtime dependencies. Run it from this checkout:

```bash
node scripts/skillcheck.mjs path/to/SKILL.md
node scripts/skillcheck.mjs --compare before.md after.md --format md
node scripts/skillcheck.mjs --folder path/to/skill --output review.json
node scripts/skillcheck.mjs --calibration --output calibration.json
node --test scripts/skillcheck.test.mjs
```

Output files must not already exist, preventing accidental source/report overwrites.
For CI, check out a pinned Skillcheck revision and run the same command against
your selected skill folder:

```bash
node scripts/skillcheck.mjs --folder path/to/skill --fail-on-high --output review.json
```

Exit `0` means analysis completed, `1` means the explicitly requested high-suspicion
gate found a match, and `2` means invalid input or an I/O error. Store the report as
an artifact even when the gate fails. This optional gate is a review signal, not a
safety clearance; without `--fail-on-high`, findings do not change the exit status.

### Other commands

```bash
pnpm build       # type-check and produce a production build in dist/
pnpm preview     # serve the production build locally
pnpm check       # format, lint, and type-check (Oxfmt + Oxlint + tsc)
pnpm test        # run the Vitest suite
```

This project uses [Vite+](https://viteplus.dev), a unified toolchain. The
scripts above wrap its `vp` CLI. Run `pnpm exec vp help` to see everything it
offers.

---

## Tech stack

- **React 19** function components and hooks, in `StrictMode`.
- **TypeScript** in strict mode (`noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, and friends).
- **Vite+** for dev, build, lint (Oxlint), format (Oxfmt), and test (Vitest +
  jsdom).
- **CSS Modules**, no runtime styling dependency.
- No application runtime dependencies beyond React itself.

## Architecture

The code is layered so that all analysis is pure and framework-free:

```
src/
  domain/        Pure logic, no React. The heart of the project.
    diff/        Myers line diff and side-by-side view construction.
    quality/     Scoring rules, per-dimension analysis, comparison.
    injection/   Pattern rules, confusable normalization, suspicion scoring.
    shared/      Markdown helpers and shared types.
  hooks/         React state: file loading, analysis composition, filters.
  components/    Presentational UI: diff, quality, injection panels.
```

Domain functions take content in and return plain data out, so they are tested
directly without rendering anything. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
for a fuller tour.

---

## Contributing

Issues, bug reports, and forks are welcome. Because Skillcheck analyzes
untrusted skill content, the merge process is deliberately conservative: only
maintainers merge, and every change is reviewed. Read
[CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request, and
[SECURITY.md](SECURITY.md) to report a vulnerability.

You are free to fork this project and build whatever you like on top of it,
within the terms of the license.

## License

[MIT](LICENSE) © Arslan Abdallah
