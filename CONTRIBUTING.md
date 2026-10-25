# Contributing to Kirana

Thank you for wanting to help. Kirana is small and independent, so every good
bug report, docs fix and pull request moves it noticeably. This page says what
helps most and how to get a change merged without a round of back-and-forth.

The same guide is on the docs site at `/docs/project/contributing`, and the
ways to support the project with money are at `/sponsors`.

## Report a bug

The most valuable contribution at this stage. A good report has:

- **What you ran**: the Kirana version, your framework and bundler, and the
  smallest source that shows the problem.
- **What you expected and what happened**: the computed style you expected,
  and the one you got. `kirana-style trace <file>:<line> <property>` prints every
  entry for a style and the one that won; paste its output.
- **The diagnostic**, if there was one, with its code (`KRN…`).

A style that compiles and renders wrong is a bug even when no diagnostic fired;
report it. So is a diagnostic whose help text did not tell you what to do.

## Improve the docs

If a page made you guess, it is wrong. Open an issue naming the page and the
sentence, or send the fix. Docs live in `apps/docs/content/docs/`; run
`bun run generate` in `apps/docs` after editing, so the generated pages and the
search index follow.

Every statement in the docs should be true of the code today. A claim about
performance, size or another project needs a source or a measurement beside it.

Counts and lists (diagnostics, lint rules, packages, frameworks, bundlers,
linters, commands) are never typed: pages read them from
`apps/docs/src/data/facts.ts`, and markdown writes `{{fact:name}}`. A product a
page names shows its logo. `vp run check` fails on a hand-written count, a
partial list or a missing logo; [`apps/docs/CONSISTENCY.md`](apps/docs/CONSISTENCY.md)
explains the rules and how to mark a list that is deliberately partial.

## Change the code

### Before you start

**Open an issue first** for anything beyond a small, obvious fix, and wait for a
maintainer to agree on the approach. It saves you writing a pull request that
cannot be merged. Pull requests that only reformat, rename or reorder code are
not accepted: the formatters and linters own that.

### Set up

```bash
vp install             # dependencies, and the git hooks
vp run check           # format, lint, types, docs consistency
vp run rust            # cargo fmt, Clippy, cargo-deny, Rust tests
vp run test            # Vitest
vp run build           # native engine, then the docs site
```

Vite+ (`vp`) and Rust (through rustup) are the two installs. The README's
Scripts table lists what each command needs. The pre-push hook (`vp run prepush`)
runs the checks, the Rust lints, the tests with 100 % coverage, the Zed
extension's own Rust checks and the budgets, from the cache when nothing changed.

### What a pull request needs

- **Tests, and 100 % coverage.** Kirana's packages keep 100 % coverage of Rust
  lines, functions and regions, and of TypeScript statements, branches, functions and
  lines. `vp run coverage` checks it. A change that lowers it fails CI.
- **The budgets record, when the output or the types change.** It records:
  - what the compiler's output weighs: each golden fixture, `packages/ui`,
    `packages/docs-ui` and the runtime, raw, gzip and brotli;
  - how many types and instantiations checking the API costs.

  A change to either fails `vp run budgets` until `bun run budgets --update` in
  `packages/kirana` rewrites the record. Commit it with the change, so the diff
  shows what moved; CI prints the difference as a table in the job summary.

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
- **A Conventional Commit title.** Pull requests are squash-merged, so the
  title becomes the commit on `main`, and the release reads it: `feat: …` for a
  feature, `fix: …` for a bug fix, `perf:`, `docs:` or `deps:` for those, and
  `refactor:`, `test:`, `build:`, `ci:` or `chore:` for changes users do not
  see. A breaking change adds `!` (`feat!: …`) and says what breaks in the
  description. Lower case, no full stop. A check on the pull request enforces it.

### What CI runs

Your pull request runs on Linux: lint, types, the tests at 100 % coverage, the
examples on their dev servers, and installation with npm, pnpm and Bun, plus
one Windows job (the stylesheet built twice, to compare). It needs no macOS
runner, the scarce kind, so it starts quickly however many pull requests are
open. A change to the site or to prose alone skips the package
jobs.

When a maintainer queues it for merging, the merge queue runs the rest of Linux
once on the commit that will land on `main`: the Arm engines, and installation
with every package manager on x64 and Arm. It needs no macOS or Windows runner
either, so several queued pull requests are tested at once. A failure there
sends the pull request back with the reason.

macOS and Windows are tested every night and again before each release, which
installs every engine on every OS before anything is published. A job that
never got a runner is retried on its own, so a busy macOS pool needs nothing
from you.

### How a change is released

Everything ships under one version. Each merge to `main` updates a Release
pull request that holds the next version and the changelog, written from the
titles above. Merging it tags `vX.Y.Z`; the packages are then built for every
platform, installed into the examples with every package manager, and published
to npm, RubyGems, Hex, Packagist, the VS Code Marketplace and Open VSX after a
maintainer approves. You never bump a version or edit `CHANGELOG.md` by hand.

### Security

- Do not change files under `.github/workflows/` in the same pull request as
  other work; a workflow change is reviewed on its own.
- Report a vulnerability privately, never in a public issue: see `SECURITY.md`.
- CI actions and runner images are pinned to an exact version, never written
  from memory: check the action's latest release and that it runs on a
  supported runtime.

## Support the project

Kirana is MIT licensed and free to use. If it saves you time, `/sponsors` lists
every way to support it (GitHub Sponsors, Open Collective, Polar, and invoices for
companies) once each channel opens.

## Conduct

Be kind, be specific, and assume good intent. Critique code and ideas, never
people. The full code of conduct is the Contributor Covenant, in
`CODE_OF_CONDUCT.md`.
