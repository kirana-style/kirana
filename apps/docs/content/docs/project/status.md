---
title: What works today
description: What is built, what is partial and what is planned.
section: project
order: 1
keywords: [status, support, what works, pre-release, limitations]
---

# What works today

Kirana is pre-release. It compiles three real applications in our shadcn/ui port
(a demo, 60+ shadcn blocks and one page per component), and its own test suite
keeps 100 % line coverage. It is not published, and the name is a working name.

## Built

- {{fact:api}}
- The `sx` prop in {{fact:libraries}} (as `[sx]` in Angular templates and the
  `sx` helper in Ember's); see [supported frameworks](/docs/frameworks/overview)
- Conditions: pseudo-classes, attributes, compounds, at-rules, nesting
- The precedence ladder, layers, and the ambiguity diagnostic
- Tokens: inlined, variable, per-mode, registered (`@property`)
- Themes and colour modes
- Dynamic values: class expressions, the custom-property bridge, the runtime of under {{fact:runtime-size}}
- {{fact:diagnostics}} diagnostics with stable codes
- `@kirana-style/vite` for Vite 8, with hot updates
- An adapter package for every other bundler, and one for Jest; see
  [bundlers](/docs/integrations/bundlers)
- `@kirana-style/next` and `@kirana-style/postcss`: Next.js on Turbopack and on webpack; see
  [Next.js](/docs/frameworks/nextjs)
- `@kirana-style/angular`: the `[sx]` directive, builders for the Angular CLI, and a
  Vite plugin for Analog; see [Angular](/docs/frameworks/angular)
- React Router, Gatsby (`@kirana-style/gatsby`), Ember (`@kirana-style/ember`), Meteor and
  Parcel (`@kirana-style/parcel-transformer`), each with a tested example
- Server templates: the class map `kirana build` and `kirana dev` write, and
  helpers for Laravel and Symfony (PHP), Rails (Ruby), Phoenix (Elixir) and
  AdonisJS; see [server templates](/docs/frameworks/server-templates)
- The command line: setting a project up and checking it (with a bug report),
  compiling without a bundler, reports for CI with GitHub annotations, the design
  system as JSON, tracing a property, and both codemods; see
  [the CLI](/docs/tooling/cli)
- `firstThatWorks()`, `positionTry()` and `viewTransition()`: value fallbacks,
  `@position-try` rules and view-transition classes, each checked at build time;
  see [fallback values](/docs/styling/fallbacks),
  [anchor positioning](/docs/styling/anchor-positioning) and
  [view transitions](/docs/styling/view-transitions)
- `@kirana-style/preset-scales`: Tailwind v4 scales as tokens, and its utility names as
  [utility strings](/docs/styling/utilities) in `sx`
- `kirana migrate tailwind`, proven on the Tailwind original of our shadcn/ui port: zero
  computed-style differences after the codemod and 38 hand fixes
  ([the numbers](/docs/migration/from-tailwind#measured-this-repository-s-tailwind-original))

- `kirana lsp`, the language server, with VS Code and Zed extensions, in
  TypeScript, Vue, Svelte and Astro files and Angular templates; see
  [editor support](/docs/tooling/editor)
- `@kirana-style/eslint-plugin` under Oxlint and ESLint, identical results, and
  `@kirana-style/biome-plugin` with the {{fact:biome-rules-word}} rules Biome can run; see
  [lint](/docs/tooling/lint)
- Agent skills for writing Kirana and migrating to it, installable with
  `npx skills add`; see [agent skills](/docs/project/agent-skills)

## Partial

- **`variable-default-scope`** is in the catalogue but not emitted yet.
- **Benchmarks** are advisory: hosted CI numbers, not dedicated hardware.
- **Packaging** is built but not published: `bun run kirana:pack` produces every
  package and the eight per-platform engine packages as tarballs, and CI installs
  them with npm, pnpm, Yarn (both linkers) and Bun on Linux, macOS, Windows and
  Alpine.

## Not built

- Publishing to npm
- Publishing the editor extensions to the VS Code Marketplace, Open VSX and Zed's registry
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
