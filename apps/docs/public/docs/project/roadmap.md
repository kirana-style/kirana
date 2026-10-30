# Roadmap
Source: https://kirana.style/docs/project/roadmap

# Roadmap

The roadmap has seven milestones and two decision gates;
six of them are done and on npm, and the last is 1.0. Dates are deliberately absent: this is built by one person with AI
assistance, and a date would be fiction.

| Milestone | Status | What it covers |
| --- | --- | --- |
| M0: Foundations | Done | The IR, the cascade ladder, the CSS writer |
| M1: Feasibility slice | Done | Vite, React, tokens and themes, the first conformance runs |
| M2: Recipes and dynamic styles | Done | recipe(), dynamic values, hot updates, the StyleX codemod |
| M3: Developer experience | Done | The language server, the editors, lint and the CLI |
| M4: Ecosystem | Done | Every bundler and framework, published to npm |
| M5: Utility surface | Done | Utility strings, the scales preset, the Tailwind codemod |
| M6: 1.0 | Next | API freeze, a public benchmark, a security review |

Until 1.0, releases come from the work below as it lands, each listed in the
[changelog](/changelog).

## M0: Foundations

**Done.** The core every later milestone builds on:

- the workspace, the IR, longhand expansion and normalisation;
- the precedence ladder and the layer plan;
- the CSS writer and its golden fixtures;
- `kirana-style build`.

## M1: Feasibility slice

**Done.** Enough of Kirana to style a real application:

- the Vite adapter and cross-file resolution;
- `sx` for React, relations and `select`;
- keyframes, modes and themes, and the scales preset;
- the first conformance runs against the StyleX and Tailwind originals.

## M2: Recipes and dynamic styles

**Done.** Styles that depend on props and state:

- `recipe()` with slots, and finite and open dynamic values;
- the private runtime, incremental rebuilds and hot updates;
- `kirana-style migrate stylex`;
- the full component set of our shadcn/ui port built on it, which is what
  found most of the compiler's bugs.

One thing in this milestone's scope is deliberately not built: a persistent cache
on disk. The engine is 0.05 s of a 16 s build, so a cache that skips it saves
nothing you could measure, and every key it has to get right is a way to serve
stale CSS.

## M3: Developer experience

**Done, and published.** Editor and lint support, read from the compiler rather
than re-implemented, so they never disagree with the build.

- **The language server**, [`kirana-style lsp`](/docs/tooling/editor):
  diagnostics at the property, hover with the compiled CSS and the ladder step
  that won, tokens in both modes, colour swatches, a summary after every `sx`,
  completion, navigation and quick fixes. Hover answers in 1.2 ms at the 95th
  percentile on our shadcn/ui port.
- **Editors:** the extension on the VS Code Marketplace and Open VSX, and the
  same server in Vue, Svelte and Astro files; Zed through a dev extension, and
  Neovim and Helix through their own LSP configuration.
- **Lint:** [`@kirana-style/eslint-plugin`](/docs/tooling/lint) under Oxlint and
  ESLint, and [`@kirana-style/biome-plugin`](/docs/tooling/lint#biome) with the
  five rules Biome can run.
- **The command line:** setting a project up and checking it, with a redacted
  bug report; compiling without a bundler; sizing the stylesheet; the design
  system as JSON; and reports for CI with GitHub annotations. The
  [CLI page](/docs/tooling/cli) has every command.
- **CSS helpers checked at build time:**
  [`firstThatWorks()`](/docs/styling/fallbacks),
  [`positionTry()`](/docs/styling/anchor-positioning),
  [`viewTransition()`](/docs/styling/view-transitions) and
  [`counterStyle()`](/docs/styling/at-rules#counter-styles).
- **[Agent skills](/docs/project/agent-skills)**, `kirana` and `kirana-migrate`.

Still to do: publishing the Zed extension to Zed's registry.

## M4: Ecosystem

**Done, and published.** Kirana installed outside this repository, and proven so
on every change.


- **Every package on npm**, released together from CI with provenance, and the
  native engine for eight platforms plus a WASI build that writes the same bytes.
- **Installation tested on every change:** CI installs the packed tarballs with
  npm, pnpm, Yarn and Bun on Linux, macOS, Windows and Alpine, builds an example
  and checks it in a browser. Installing from the registry with Yarn and Deno,
  which CI cannot test against tarballs, was checked by hand with 0.2.0.
- **Bundlers:** Vite, Rolldown, webpack, Rspack and Rsbuild, Parcel, Bun,
  esbuild, PostCSS and Jest, each with an example, and a check that every one
  compiles the same source to the same classes as Vite.
- **Frameworks:** a guide and a tested example for each, from React, Vue, Svelte,
  Solid, Qwik, Angular and Ember to Next.js, Nuxt, SvelteKit, Astro and
  Analog.
- **Server templates:** Laravel, Symfony, Rails, Phoenix and AdonisJS, through a
  class map and a helper per template language, published to Packagist,
  RubyGems, Hex and npm.

## M5: Utility surface

**Done.** [Utility strings](/docs/styling/utilities) in `sx`, from a grammar a
preset declares as data.

- `@kirana-style/preset-scales` ships Tailwind v4's names, including composed
  utilities (rings, shadows, translations, filters) and pseudo-elements. A
  property test compiles all 7,391 utilities the grammar generates and checks
  each gives the same atoms as its object.
- `kirana-style migrate tailwind` is built on the same lowering. Run over the
  Tailwind original of our shadcn/ui port, then 38 hand fixes, conformance finds
  **zero computed-style differences** on all 189 routes of the three
  applications, at three widths, in both colour schemes, at rest and with
  overlays and menus open. The [migration guide](/docs/migration/from-tailwind)
  has the numbers and every pitfall the hand fixes resolved.

## M6: 1.0

**Next.** What 1.0 promises, and what it takes to promise it:

- an API freeze, after which a breaking change waits for 2.0;
- the full conformance suite;
- a public benchmark report under the claims policy;
- trademark clearance for the name;
- a security review of the evaluator.

Before it, one change outside these milestones: restricted overrides, where a
component declares which properties its `sx` accepts (`Sx<"color" | "margin">`),
checked by TypeScript at the call site.

## Beyond the compiler

Products built on Kirana, each released on its own. Kirana UI is there to use
with the compiler; the rest are planned, with no dates for the same reason.

| Product | Status | What it is |
| --- | --- | --- |
| [Kirana UI](https://ui.kirana.style) | Available | A registry of components styled with Kirana, installed with `kirana-style ui add` |
| Kirana Docs | Planned | Markdown pages built ahead of time on TanStack Start, with a twin of each page for agents |
| Kirana Headless | Planned | The behaviour of menus, dialogs and fields, with no styles of its own |
| Kirana Email | Planned | Styles inlined and checked against what email clients support |
| Kirana PDF | Planned | Pages, margins and breaks written as typed styles |
| Kirana Native | Planned | The same `css()` handles, compiled to style objects for mobile apps |
| Kirana Desktop | Planned | Templates and checked examples for desktop shells |

## The gates

Two points where the project checked itself rather than continuing by momentum:

- **Gate 1**, after M1: does the output hold up against the originals, and is
  the authoring API worth the trouble?
- **Gate 2**, after M2: do recipes and dynamic styles carry a real application?

Both are passed. The [status page](/docs/project/status) lists what that means
concretely.
