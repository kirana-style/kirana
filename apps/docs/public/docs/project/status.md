# What works today
Source: https://kirana.style/docs/project/status

# What works today

Kirana is on npm, at a 0.x version: before 1.0, a minor version may change the
API. It compiles three real applications in our shadcn/ui port (a demo, 60+
shadcn blocks and one page per component), and its own test suite keeps 100 %
line coverage. The [changelog](/changelog) lists every release.

## Built

- `css`, `cx`, `props`, `recipe`, `relation`, `select`, `keyframes`, `defineTokens`, `defineTheme`, `mode`, `firstThatWorks`, `positionTry`, `counterStyle`, `viewTransition`, `media`, `container` and `supports`
- The `sx` prop in React, Preact, Solid, Qwik, Vue, Svelte, Astro, Angular and Ember (as `[sx]` in Angular templates and the
  `sx` helper in Ember's); see [supported frameworks](/docs/frameworks/overview)
- Conditions: pseudo-classes, attributes, compounds, at-rules, nesting
- The precedence ladder, layers, and the ambiguity diagnostic
- Tokens: inlined, variable, per-mode, registered (`@property`)
- Themes and colour modes
- Dynamic values: class expressions, the custom-property bridge, the runtime of under 1.1 kB
- 50 diagnostics with stable codes
- `@kirana-style/vite` for Vite 8, with hot updates
- An adapter package for every other bundler, and one for Jest; see
  [bundlers](/docs/integrations/bundlers)
- `@kirana-style/next` and `@kirana-style/postcss`: Next.js on Turbopack and on webpack; see
  [Next.js](/docs/frameworks/nextjs)
- `@kirana-style/angular`: the `[sx]` directive, builders for the Angular CLI, and a
  Vite plugin for Analog; see [Angular](/docs/frameworks/angular)
- React Router, Gatsby (`@kirana-style/gatsby`), Ember (`@kirana-style/ember`), Meteor and
  Parcel (`@kirana-style/parcel-transformer`), each with a tested example
- Server templates: the class map `kirana-style build` and `kirana-style dev` write, and
  helpers for Laravel and Symfony (PHP), Rails (Ruby), Phoenix (Elixir) and
  AdonisJS; see [server templates](/docs/frameworks/server-templates)
- The command line: setting a project up and checking it (with a bug report),
  compiling without a bundler, reports for CI with GitHub annotations, the design
  system as JSON, tracing a property, and both codemods; see
  [the CLI](/docs/tooling/cli)
- CSS helpers, each checked at build time:
  - `firstThatWorks()`: [fallback values](/docs/styling/fallbacks)
  - `positionTry()`: [anchor positioning](/docs/styling/anchor-positioning)
  - `viewTransition()`: [view transitions](/docs/styling/view-transitions)
  - `counterStyle()`: [counter styles](/docs/styling/at-rules#counter-styles)
- `@kirana-style/preset-scales`: Tailwind v4 scales as tokens, and its utility names as
  [utility strings](/docs/styling/utilities) in `sx`
- `kirana-style migrate tailwind`, proven on the Tailwind original of our shadcn/ui port: zero
  computed-style differences after the codemod and 38 hand fixes
  ([the numbers](/docs/migration/from-tailwind#measured-this-repository-s-tailwind-original))

- `kirana-style lsp`, the language server, with VS Code and Zed extensions, in
  TypeScript, Vue, Svelte and Astro files and Angular templates; see
  [editor support](/docs/tooling/editor)
- `@kirana-style/eslint-plugin` under Oxlint and ESLint, identical results, and
  `@kirana-style/biome-plugin` with the five rules Biome can run; see
  [lint](/docs/tooling/lint)
- Agent skills for writing Kirana and migrating to it, installable with
  `npx skills add`; see [agent skills](/docs/project/agent-skills)
- Every package on npm, with the native engine for eight platforms and a WASI
  build, released together from CI with provenance; the template helpers on
  Packagist, RubyGems and Hex; the VS Code extension on the Marketplace and Open
  VSX. CI installs the packed packages with npm, pnpm, Yarn (both linkers) and Bun
  on Linux, macOS, Windows and Alpine on every change

## Partial

- **`variable-default-scope`** is in the catalogue but not emitted yet.
- **Benchmarks** are advisory: hosted CI numbers, not dedicated hardware.
- **The Zed extension** works, but is not in Zed's registry yet: install it as a
  dev extension; see [editor support](/docs/tooling/editor).

## Not built

- The `slide-in-from-start` and `-end` animations, and gradients (`bg-linear-*`
  and its stops), in the scales preset
- A persistent cache on disk: deliberately not built, because the engine is
  0.05 s of a 16 s build and a cache that skips it would save nothing

## Known rough edges

- A shorthand whose value is a single custom property cannot be split, so a later
  style cannot remove one of its longhands precisely. The compiler warns
  (`unsplittable-shorthand`).
- Diagnostics point at the module that _uses_ a value, which is usually where the
  fix belongs, but sometimes the definition is elsewhere.
