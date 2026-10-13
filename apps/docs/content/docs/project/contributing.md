---
title: Contributing
description: How to report a bug, fix the docs, get a pull request merged, and support Kirana.
section: project
order: 6
keywords: [contributing, bug report, pull request, dco, sign-off, sponsor, help]
---

# Contributing to Kirana

Thank you for wanting to help. Kirana is small and independent, so every good
bug report, docs fix and pull request moves it noticeably. This page says what
helps most and how to get a change merged without a round of back-and-forth.

The same guide is `CONTRIBUTING.md` in the repository, and the ways to support
the project with money are on the [sponsors page](/sponsors).

## Report a bug

The most valuable contribution at this stage. A good report has:

- **What you ran**: the Kirana version, your framework and bundler, and the
  smallest source that shows the problem.
- **What you expected and what happened**: the computed style you expected,
  and the one you got. `kirana trace <file>:<line> <property>` prints every
  entry for a style and the one that won; paste its output.
- **The diagnostic**, if there was one, with its code (`KRN…`).

A style that compiles and renders wrong is a bug even when no diagnostic fired —
report it. So is a diagnostic whose help text did not tell you what to do.

## Improve the docs

If a page made you guess, it is wrong. Open an issue naming the page and the
sentence, or send the fix. Docs live in `apps/docs/content/docs/`; run
`bun run generate` in `apps/docs` after editing, so the generated pages and the
search index follow.

Every statement in the docs should be true of the code today. A claim about
performance, size or another project needs a source or a measurement beside it.

## Change the code

### Before you start

**Open an issue first** for anything beyond a small, obvious fix, and wait for a
maintainer to agree on the approach. It saves you writing a pull request that
cannot be merged. Pull requests that only reformat, rename or reorder code are
not accepted: the formatters and linters own that.

### Set up

```bash
bun install
bun run check          # oxlint, oxfmt, types
bun run kirana:check   # cargo fmt, Clippy, cargo-deny, Rust tests, Vitest
bun run build          # native engine, then the apps
```

Rust is installed through rustup. The README's Scripts table lists what each
`kirana:*` command needs.

### What a pull request needs

- **Tests, and 100 % coverage.** Kirana's packages keep 100 % coverage — Rust
  lines, functions and regions; TypeScript statements, branches, functions and
  lines. `bun run kirana:coverage` checks it. A change that lowers it fails CI.
- **The specification, in the same change.** A change to the compiler's
  behaviour updates the matching document in `spec/`, and a design choice gets
  a decision in `spec/20-decisions.md`.
- **The docs, in the same change.** A new token, diagnostic, option or
  behaviour is not finished until `apps/docs` says so.
- **Evidence for a trade-off.** If your change makes something worse to make
  something else better, show the failing case, the numbers and a test.
- **A sign-off on every commit.** Contributions are accepted under the
  [Developer Certificate of Origin](https://developercertificate.org/): add
  `Signed-off-by: Your Name <you@example.com>` with `git commit -s`, certifying
  you have the right to submit the work under the project's licence.

### Security

- Do not change files under `.github/workflows/` in the same pull request as
  other work; a workflow change is reviewed on its own.
- Report a vulnerability privately, never in a public issue: see `SECURITY.md`.
- CI actions and runner images are pinned to an exact version, never written
  from memory: check the action's latest release and that it runs on a
  supported runtime.

## Support the project

Kirana is MIT licensed and free to use. If it saves you time,
[the sponsors page](/sponsors) lists every way to support it — GitHub Sponsors,
Open Collective, Polar, and invoices for companies — once
each channel opens.

## Conduct

Be kind, be specific, and assume good intent. Critique code and ideas, never
people. The full code of conduct is the Contributor Covenant, in
`CODE_OF_CONDUCT.md`.
