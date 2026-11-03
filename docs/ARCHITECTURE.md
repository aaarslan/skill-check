# Architecture

Skillcheck is a single-page React app with no backend. Its defining principle
is that **all analysis is pure and framework-free**. React only loads files,
composes results, and renders them. The interesting logic lives in `src/domain`
and can be tested without rendering a single component.

## Layers

```
src/
  domain/        Pure TypeScript. No React, no DOM, no I/O.
    diff/        Line diff and view construction.
    quality/     Deterministic quality scoring.
    injection/   Prompt-injection pattern detection.
    spec/        Agent Skills specification compliance (frontmatter + layout).
    review/      Shared browser/CLI entrypoint, input limits, portable reports.
    calibration/ Labeled synthetic corpus (dev + held-out splits) and metrics.
    shared/      Markdown helpers and cross-cutting types.
  hooks/         React state and the wiring between domain functions.
  components/    Presentational UI, grouped by feature area.
  styles/        Global stylesheet. Everything else uses CSS Modules.
```

Data flows one way: file content enters through a hook, passes through pure
domain functions, and comes back as plain data that components render. Analysis
is never stored as its own state, so it can never drift out of sync with the
loaded files.

## Domain

### `domain/diff`

A Myers O(ND) line diff (`diffLines.ts`) produces a sequence of typed diff
lines. `sideBySide.ts` folds that sequence into aligned left/right rows for the
two-column view, and `navigation.ts` computes the changed regions used for
keyboard jumping. Everything is a pure transform over strings and arrays.

### `domain/quality`

`analyze.ts` runs each rule in `quality/rules/` (purpose, structure,
actionability, consistency, integrity) over a document and collects findings.
`scoring.ts` turns findings into a 0 to 100 score per dimension and an overall
band. `compare.ts` diffs two reports into the comparison summary. `crossFileLinks.ts`
resolves anchor links that point at the sibling file, which is the one check
that needs both documents at once, so it runs at the comparison layer rather
than as a single-document rule.

### `domain/injection`

`detect.ts` is the entry point. Each rule in `injection/rules/` targets one
category (instruction override, impersonation, secret and data exfiltration,
system command, safety disable, scope violation, encoded payload, fake
delimiter, hidden content). Before matching, `normalize.ts` maps confusable
characters to a canonical form so lookalike glyphs cannot slip a payload past a
literal scan. `quotedContext.ts` and `mood.ts` downgrade matches that read as
description or quotation rather than instruction, and `densityDampening.ts`
prevents a single noisy file from flooding one category. `suspicion.ts` assigns
the final high/medium/low level. `taxonomy.ts` holds the typed category and
suspicion enumerations so ordering never depends on object-key iteration.

### `domain/spec`

`frontmatter.ts` is a bounded YAML-subset parser (scalar and folded/literal
block values plus a `metadata:` map) with no dependency. `validate.ts` checks
one SKILL.md against the Agent Skills specification and, at package level,
checks SKILL.md presence. Findings use `spec/*` rule ids, ride along in review
reports and SARIF, and deliberately do not change quality scores.

### `domain/review` and `domain/calibration`

`analyzeReview` is the one pure entrypoint shared by browser and CLI; it owns
report schema 1.1 and the rule version. `report.ts` renders JSON, Markdown,
and SARIF 2.1.0, and re-imports decisions from 1.x JSON reports. Calibration
keeps a dev split (used while tuning) separate from a held-out split; metrics
in the UI are held-out only.

## Hooks

- `useFileLoader` manages one file slot (idle, loading, loaded, error) from
  upload, drag and drop, or paste.
- `useSkillCheckAnalysis` composes two loaders with the domain functions and
  exposes a single discriminated `view` union (`empty`, `original-only`,
  `candidate-only`, `both`). Encoding the "both files ready" invariant here
  keeps the joint non-null guarantee in the layer that owns the analysis, so the
  UI never re-derives it.
- `useFindingFilters` is the shared multi-select filter state used by both the
  quality and injection panels.
- `useDismissedFindings` tracks which injection findings the user has triaged
  away.
- `useReviewDecisions` owns open/reviewed/dismissed decisions shared by the
  injection panels and report workflow, including decision import.
- `usePackageLoader` reads a selected folder as bounded inert text sources.
  Analysis inputs pass through `useDeferredValue` so typing and file edits
  stay responsive ahead of recomputation.
- `useAsyncReview` runs `analyzeReview` in a shared Web Worker
  (`domain/review/analysisWorker.ts`) keyed by a source signature, falling
  back to exact synchronous analysis when Workers are unavailable or fail;
  the worker entry is exercised by the browser suite and excluded from unit
  coverage.

## Components

`App.tsx` is a thin shell over `ModePicker` and `ResultsSection`. Other
components are grouped by feature: `Diff`, `Quality`, `Injection`, `Spec`, plus `FileInput`,
`Filters`, and small shared pieces (`common/EmptyState`, `common/ErrorBoundary`,
`SeverityBadge`). Presentational components receive plain data and render it.
State and analysis live in the hooks above. Diff, folder review, and
calibration panels are lazy-loaded chunks; diff tables window to 600 rows with
an explicit show-all control.

## Testing

Because the domain is pure, tests call functions directly with input strings
and assert on returned data, including seeded property tests that reconstruct
both documents from generated diffs. Component behavior that matters (finding
lists, the full App flows) has render tests, and an axe wcag2a/2aa pass guards
the initial screen against serious accessibility violations. The CLI has its
own `node:test` suite including browser/CLI parity, an E2E smoke test builds, previews, and fetches the served shell, and a
Playwright suite (`pnpm test:browser`, system Chrome) drives all three modes
in a real browser through the Worker path, in both color schemes with
screenshots, plus a mobile viewport. The palette is fully variable-driven,
so dark remains default and light follows `prefers-color-scheme`. Coverage thresholds
(statements 85, branches 73, functions 80, lines 86) run via `pnpm coverage`.

## Conventions

- `readonly` by default; discriminated unions for state that has distinct
  shapes.
- No `any`, and no `as` casts used to silence the type checker.
- Files stay focused. A module that grows past a few hundred lines or takes on a
  second responsibility gets split.
