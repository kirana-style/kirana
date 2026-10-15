# Roadmap
Source: https://kirana.style/docs/project/roadmap

# Roadmap

Seven milestones, two decision gates. Dates are deliberately absent: this is built
by one person with AI assistance, and a date would be fiction.

## M0: Foundations · done

The workspace, the IR, longhand expansion and normalisation, the ladder and layer
plan, the CSS writer, golden fixtures, `kirana-style build`.

## M1: Feasibility slice · done

The Vite adapter, cross-file resolution, `sx` for React, relations, `select`,
keyframes, modes and themes, the scales preset, and the first conformance runs
against the StyleX and Tailwind originals.

## M2: Recipes and dynamic styles · done

`recipe()` with slots, finite and open dynamic values, the private runtime,
incremental rebuilds and hot updates, `kirana-style migrate stylex`, and the full
component set built on it, which is what found most of the compiler's bugs.

One thing in this milestone's scope is deliberately not built: a persistent
cache on disk. The engine is 0.05 s of a 16 s build, so a cache that skips it
saves nothing you could measure, and every key it has to get right is a way to
serve stale CSS.

## M4: Ecosystem · done, pending publication

Kirana installable outside this repository, and proven so on every change. Built
so far: the packages and the eight per-platform engine packages are packed as
tarballs, and CI installs them with npm, pnpm, Yarn and Bun on Linux, macOS,
Windows and Alpine, builds an example and checks it in a browser.


Also built: adapters for Rolldown, webpack (with Next.js on webpack), Rspack
(with Rsbuild) and Bun, each with an example the same CI builds and checks.

Also built: Preact and Solid, where `sx` compiles to `class`, and plain
TypeScript through class strings.

Also built: Vue, Nuxt, Svelte, SvelteKit and Astro, with `sx` in their templates,
an install guide per framework, and every Vite-based one checked in its dev server
on every change.

Also built: Qwik 2, where `sx` compiles to `class`; and Angular, through an `[sx]`
directive, with builders for the Angular CLI and a Vite plugin for Analog. Each
has an example CI builds and checks in a browser and in its dev server.

Also built: a guide and a tested example for every framework Tailwind documents
(React Router, Gatsby, Ember, Meteor and Parcel), and server templates in Laravel,
Symfony, Rails, Phoenix and AdonisJS, through a class map and a helper per
template language.

Also built: the **WASI engine**, which runs where no native build does and writes
the same bytes; and published libraries, compiled by the apps that list them in
`libraries`.

Also built: esbuild and Jest; style updates on every development server; Deno as
a runtime; and a check that every bundler compiles the same source to the same
classes as Vite.

What remains waits on publishing to npm: installing with Yarn and Deno from the
registry.

## M5: Utility surface · done

[Utility strings](/docs/styling/utilities) in `sx`, from a grammar a preset
declares as data; `@kirana-style/preset-scales` ships Tailwind v4's names, including
composed utilities (rings, shadows, translations, filters) and pseudo-elements.
A property test compiles all 7,391 utilities the grammar generates and checks
each gives the same atoms as its object.

`kirana-style migrate tailwind` is built on the same lowering. The exit criterion was
to migrate the Tailwind original of our shadcn/ui port with it and match the original:
after the codemod and 38 hand fixes, conformance finds **zero computed-style
differences** on all 189 routes of the three applications, at three widths, in
both colour schemes, at rest and with overlays, menus and other interactive
states open. The [migration guide](/docs/migration/from-tailwind) has the numbers
and every pitfall the hand fixes resolved.

The language server's support for utility strings moved to M3.

## M3: Developer experience · done, pending publication

Editor and lint support, read from the compiler rather than re-implemented, so
they never disagree with the build.

**Built** (sprint 6):

- **Language server**, [`kirana-style lsp`](/docs/tooling/editor): diagnostics at the
  property, hover with the compiled CSS and the winning entry's ladder step,
  token values in both modes, colour swatches, an inline summary after every
  `sx`, code lenses, completion for conditions, `select` targets, keyword values
  and utility strings, navigation for tokens and relations, and code actions
  (quick fixes, show compiled CSS, explain precedence, and convert Tailwind classes
  to `css()`). Hover answers in 1.2 ms at the 95th percentile on our shadcn/ui port.
- **VS Code and Zed extensions**, running the project's own server; Neovim and
  Helix through their own LSP configuration.


- **[`@kirana-style/eslint-plugin`](/docs/tooling/lint)**: nine rules under Oxlint and
  ESLint with identical results, each described on the lint page. This repository
  lints itself with them.

**Built** (sprint 7):

- **Editors in Vue, Svelte and Astro components**, the style card (box model,
  every declaration, compiled CSS), coloured summaries at the end of each line,
  the Style Inspector and Style Fold.
- **CLI**: [`init`](/docs/tooling/cli#kirana-style-init) sets a project up from a diff,
  [`doctor`](/docs/tooling/cli#kirana-style-doctor) checks it,
  [`dev`](/docs/tooling/cli#kirana-style-dev) watches without a bundler, and
  [`analyze`](/docs/tooling/cli#kirana-style-analyze) reports atoms, reuse and bytes by
  layer and module.
- **Next.js with Turbopack**, through `@kirana-style/next` and `@kirana-style/postcss`.

**Built** (sprints 10 and 11):

- **[`firstThatWorks()`](/docs/styling/fallbacks),
  [`positionTry()`](/docs/styling/anchor-positioning) and
  [`viewTransition()`](/docs/styling/view-transitions)**, each checked at build
  time, and a redacted bug report from
  [`kirana-style doctor --report`](/docs/tooling/cli#a-bug-report).
- **[`kirana-style export`](/docs/tooling/cli#kirana-style-export)**, the design system as
  JSON, and **[`kirana-style check`](/docs/tooling/cli#kirana-style-check)** with
  `--format github` and `--max-warnings` for CI.
- **Two more lint rules**, `no-dark-variant` and `no-class-helpers`, and
  **[`@kirana-style/biome-plugin`](/docs/tooling/lint#biome)** with the four rules
  Biome can run.
- **[Agent skills](/docs/project/agent-skills)**, `kirana` and `kirana-migrate`,
  installed with `npx skills add`.

**Left for the first release:** publishing the extensions to the VS Code
Marketplace, Open VSX and Zed, with the npm packages.

**Next, outside M3's scope:** restricted overrides, a component declaring which
properties its `sx` accepts (`Sx<"color" | "margin">`), checked by TypeScript at
the call site.

## M6: 1.0 · planned

API freeze, the full conformance suite, a public benchmark report under the claims
policy, trademark clearance, the documentation site at its own domain, and a
security review of the evaluator.

## The gates

Two points where the project checks itself rather than continuing by momentum:

- **Gate 1**, after M1: does the output hold up against the originals, and is the
  authoring API worth the trouble?
- **Gate 2**, after M2: do recipes and dynamic styles carry a real application?

Both are passed. The [status page](/docs/project/status) lists what that means
concretely.
