<!--
Thanks for contributing to Skillcheck. Only maintainers merge, and every change
is reviewed. A focused pull request with a clear description is merged fastest.
-->

## What and why

<!-- What does this change, and what problem does it solve? -->

## How it was validated

<!-- Commands run, flows exercised. "It compiles" is not validation. -->

- [ ] `pnpm check` passes (format, lint, type-check)
- [ ] `pnpm test` passes
- [ ] `pnpm build` succeeds

## Checklist

- [ ] The change is focused (one logical change).
- [ ] New behavior has tests; bug fixes include a regression test.
- [ ] Domain logic stays in `src/domain/` and is free of React imports.
- [ ] No unrelated reformatting.
- [ ] If detection rules or fixtures changed, any injection samples are inert
      and clearly labeled.
