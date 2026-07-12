# Contributing to Skillcheck

Thanks for your interest. Contributions are welcome, and so is forking this
project to build your own thing. This document explains how changes get in and
why the process is intentionally cautious.

## Governance: fork freely, merge carefully

Skillcheck exists to analyze untrusted LLM skill files, including files that may
contain deliberate prompt-injection payloads. That mission shapes how the
project is maintained:

- **Anyone can fork.** The [MIT license](LICENSE) lets you copy, modify, and
  redistribute the project for any purpose. Fork it and make it yours.
- **Only maintainers merge.** Direct pushes to the default branch are not
  accepted. Every change lands through a reviewed pull request that a
  maintainer approves and merges.
- **Every contribution is reviewed with a skeptical eye.** Because the codebase
  and its test fixtures deal in injection strings, reviewers pay close attention
  to sample content, new patterns, and anything that changes how findings are
  scored or suppressed.

This is not a statement of distrust toward contributors. It is the same posture
the tool itself takes toward its input.

## Ways to contribute

- **Report a bug or false positive/negative.** Open an issue with a minimal
  Markdown sample and the score or finding you expected versus what you got.
- **Suggest a detection rule or quality heuristic.** Describe the pattern, why
  it matters, and the failure mode it catches.
- **Improve docs, accessibility, or UI polish.**
- **Fix something.** Small, focused pull requests are easiest to review.

For anything security-sensitive, follow [SECURITY.md](SECURITY.md) instead of
opening a public issue.

## Development setup

Requires Node.js 22+ and pnpm 11+.

```bash
pnpm install
pnpm dev          # run the app locally
```

Before opening a pull request, make sure the full gate passes:

```bash
pnpm check        # format, lint, type-check
pnpm test         # run the Vitest suite
pnpm build        # verify the production build
```

All three must be green. "No output" or a skipped step is a failure, not a
pass.

## Pull request checklist

- [ ] `pnpm check`, `pnpm test`, and `pnpm build` all pass locally.
- [ ] New behavior has tests; bug fixes include a regression test that fails
      before the change and passes after.
- [ ] The diff is focused. One logical change per pull request.
- [ ] No unrelated reformatting. Style-only changes go in their own commit.
- [ ] Domain logic stays in `src/domain/` and remains free of React imports.
- [ ] Commit subjects are imperative and under ~72 characters.

## Code standards

This repository ships a compact rule system for both human and AI contributors
in [`engineering-rules/`](engineering-rules/). The short version:

- Complete and simple. Fix the class of bug, not just the instance, with the
  fewest moving parts.
- Read the code before changing it. A claim without a file and line you
  actually read is a guess.
- No dead code, no commented-out blocks, no bare TODOs.
- Business rules live in one layer, not scattered across UI and hooks.
- No em-dashes in prose, comments, or docs.

## Reporting sensitive samples

If you need to include a real injection payload as a test fixture, keep it
scoped to a test file, clearly labeled, and inert (it is only ever treated as
text, never executed). Do not add live secrets or personal data to fixtures.

## Code of conduct

By participating you agree to uphold the
[Code of Conduct](CODE_OF_CONDUCT.md).
