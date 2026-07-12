# Skillcheck

Compare two LLM skill Markdown files side by side: a structural **diff**, a
deterministic **quality score**, and heuristic **prompt-injection detection**.
Everything runs locally in your browser. Nothing is uploaded, stored, or
transmitted.

<p>
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149eca">
  <img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178c6">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-green">
  <img alt="Tests: 97" src="https://img.shields.io/badge/tests-97%20passing-brightgreen">
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

Load an **Original** and a **Candidate** Markdown file (upload, drag and drop,
or paste). Skillcheck then shows three views:

### 1. Diff

- Unified and side-by-side layouts.
- Myers O(ND) line diff with an optional "ignore whitespace" mode.
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

### Privacy

There is no backend. All parsing, scoring, and scanning happen in your browser
with no network requests. You can verify this in your browser's network tab, or
run it fully offline.

---

## Quick start

Requires [Node.js](https://nodejs.org) 22+ and [pnpm](https://pnpm.io) 11+.

```bash
pnpm install     # install dependencies
pnpm dev         # start the dev server, then open the printed URL
```

Then load two Markdown skill files in the browser and read the diff, scores,
and findings.

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
