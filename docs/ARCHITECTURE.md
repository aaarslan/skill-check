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

## Components

Grouped by feature: `Diff`, `Quality`, `Injection`, plus `FileInput`,
`Filters`, and small shared pieces (`common/EmptyState`, `SeverityBadge`).
Presentational components receive plain data and render it. State and analysis
live in the hooks above.

## Testing

Because the domain is pure, tests call functions directly with input strings
and assert on returned data. Component behavior that matters (finding lists) has
focused render tests. The suite runs on Vitest with jsdom. Run it with
`pnpm test`.

## Conventions

- `readonly` by default; discriminated unions for state that has distinct
  shapes.
- No `any`, and no `as` casts used to silence the type checker.
- Files stay focused. A module that grows past a few hundred lines or takes on a
  second responsibility gets split.
