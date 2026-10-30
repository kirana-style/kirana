---
title: Ecosystem and status
description: What works today, what is planned, and which milestone each thing belongs to.
section: project
order: 4
keywords: [ecosystem, status, support, bundlers, frameworks, editors, roadmap]
---

# Ecosystem and status

What exists, and where to read about it. Every package below is on npm; anything
planned is on the [roadmap](/docs/project/roadmap), not here.

## Packages

<!-- ::packages -->

## Bundlers

Each one has an example CI builds and checks in a browser on every change.

| Bundler                        | Package                                                         |
| ------------------------------ | --------------------------------------------------------------- |
| Vite 8                         | `@kirana-style/vite`, with hot updates                          |
| Rolldown                       | `@kirana-style/rolldown`                                        |
| webpack 5                      | `@kirana-style/webpack`, with dev-server updates                |
| Rspack, Rsbuild                | `@kirana-style/rspack`, with dev-server updates                 |
| Parcel                         | `@kirana-style/parcel-transformer` with `@kirana-style/postcss` |
| Bun                            | `@kirana-style/bun`, builds and dev server                      |
| esbuild                        | `@kirana-style/esbuild`                                         |
| PostCSS                        | `@kirana-style/postcss`, for any PostCSS pipeline               |
| Jest                           | `@kirana-style/jest`                                            |
| Next.js, Turbopack and webpack | `@kirana-style/next` with `@kirana-style/postcss`               |
| Storybook                      | `@kirana-style/vite`, through the Vite builder                  |

See [other bundlers](/docs/integrations/bundlers) for each one's setup.

## Frameworks

Every framework has a guide and a tested example; the
[frameworks page](/docs/frameworks/overview) picks yours.

| Framework                                                        | How styles reach the markup                                     |
| ---------------------------------------------------------------- | --------------------------------------------------------------- |
| React 19, Next.js, TanStack Start, Remix, Waku, Vike, Docusaurus | `sx` compiles to `className`; this site is a TanStack Start app |
| Preact, Solid, SolidStart, Qwik 2                                | `sx` compiles to `class`                                        |
| Vue, Nuxt, VitePress, Svelte, SvelteKit, Astro                   | `sx` in their templates                                         |
| Angular (CLI and Analog)                                         | `[sx]` in templates, merged at runtime                          |
| React Router, Gatsby, Ember, Meteor                              | as their component layer does                                   |
| No framework                                                     | handles are class strings                                       |
| Laravel, Symfony, Rails, Phoenix, AdonisJS                       | templates read a [class map](/docs/frameworks/server-templates) |

## Tooling

| Tool                                                                                    | Where                                                                |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `kirana-style build`, `check`, `analyze`, `export`, `trace`                             | [the CLI](/docs/tooling/cli)                                         |
| `kirana-style init`, `doctor`, `doctor --report`, `dev`                                 | [the CLI](/docs/tooling/cli)                                         |
| `kirana-style ui`, components installed from a registry                                 | [the CLI](/docs/tooling/cli#kirana-style-ui)                         |
| `kirana-style migrate stylex`                                                           | [migration from StyleX](/docs/migration/from-stylex)                 |
| `kirana-style migrate tailwind`, with a report of what it leaves                        | [migration from Tailwind](/docs/migration/from-tailwind#the-codemod) |
| Language server, VS Code and Zed extensions                                             | [editor support](/docs/tooling/editor)                               |
| `@kirana-style/eslint-plugin`, for Oxlint and ESLint                                    | [lint](/docs/tooling/lint)                                           |
| `@kirana-style/biome-plugin`: the {{fact:biome-rules-word}} rules that need no compiler | [lint](/docs/tooling/lint#biome)                                     |
| Agent skills                                                                            | [agent skills](/docs/project/agent-skills)                           |

## Runtime and distribution

| What runs it                                     | Detail                                                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Node.js ≥ 22.18, Bun, Deno                       | Any of them runs the compiler and the command line                                                                              |
| Native engine (Node-API)                         | A prebuilt package per platform on npm, eight in all, install-tested in CI                                                      |
| WASI fallback (WebContainers, no native addon)   | `@kirana-style/compiler-wasm32-wasi`, with byte-identical output                                                                |
| A browser page (playgrounds, editors on the web) | `@kirana-style/compiler-browser`: the WASI engine with an in-memory project and its language server, byte-identical in Chromium |

## Configuration keys in the specification but not the build

- `presets`, to compose preset packages. Import preset modules directly instead.

It fails validation today. (`libraries` works: see
[publishing a library](/docs/building/libraries).) See the [roadmap](/docs/project/roadmap) for when they
are scheduled.
