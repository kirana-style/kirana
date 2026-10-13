# Ecosystem and status
Source: https://kirana.style/docs/integrations/ecosystem

# Ecosystem and status

What exists, honestly. Anything marked planned is in the specification and not in
the build.

## Packages

<!-- ::packages -->

## Bundlers

|                                | Status                                                        |
| ------------------------------ | ------------------------------------------------------------- |
| Vite 8                         | **Works** — `@kirana-style/vite`, with hot updates            |
| Rolldown                       | **Works** — `@kirana-style/rolldown`                          |
| webpack 5                      | **Works** — `@kirana-style/webpack`, with dev-server updates  |
| Rspack, Rsbuild                | **Works** — `@kirana-style/rspack`, with dev-server updates   |
| Bun                            | **Works** — `@kirana-style/bun`, builds and dev server        |
| esbuild, Jest                  | **Works** — `@kirana-style/esbuild`, `@kirana-style/jest`     |
| Next.js, Turbopack and webpack | **Works** — `@kirana-style/next` with `@kirana-style/postcss` |

See [other bundlers](/docs/integrations/bundlers) for each one's setup.

## Frameworks

|                                            | Status                                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| React 19                                   | **Works**                                                                   |
| TanStack Start                             | **Works** — this site is one                                                |
| Preact, Solid                              | **Works** — `sx` compiles to `class`                                        |
| No framework                               | **Works** — handles are class strings                                       |
| Vue, Nuxt, Svelte, SvelteKit, Astro        | **Works** — see [frameworks](/docs/frameworks/overview)                     |
| Qwik 2                                     | **Works** — `sx` compiles to `class`                                        |
| Angular (CLI and Analog)                   | **Works** — `[sx]` in templates, merged at runtime                          |
| React Router, Gatsby, Ember, Meteor        | **Works** — see [frameworks](/docs/frameworks/overview)                     |
| Laravel, Symfony, Rails, Phoenix, AdonisJS | **Works** — templates read a [class map](/docs/frameworks/server-templates) |

## Tooling

|                                                       | Status                                                                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `kirana build`, `check`, `analyze`, `export`, `trace` | **Works**                                                                                                   |
| `kirana init`, `doctor`, `doctor --report`, `dev`     | **Works** — see [the CLI](/docs/tooling/cli)                                                                |
| `kirana migrate stylex`                               | **Works** — see [migration](/docs/migration/from-stylex)                                                    |
| `kirana migrate tailwind`                             | **Works**, with a report of what it leaves — see [migration](/docs/migration/from-tailwind#the-codemod)     |
| Language server, VS Code and Zed extensions           | **Works** — see [editor support](/docs/tooling/editor)                                                      |
| Lint plugin, `@kirana-style/eslint-plugin`            | **Works** — see [lint](/docs/tooling/lint)                                                                  |
| Lint plugin, for Biome                                | **Works**, the four rules that need no compiler — see [lint](/docs/tooling/lint#biome) |
| Agent skills                                          | **Works** — see [agent skills](/docs/project/agent-skills)                                                  |

## Runtime and distribution

|                                                | Status                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| Node.js ≥ 22.18, Bun, Deno                     | **Works**                                                               |
| Native engine (Node-API)                       | **Works**, built from source in this repository                         |
| Prebuilt per-platform packages                 | Built and install-tested in CI; not published yet                       |
| WASI fallback (WebContainers, no native addon) | **Works** — `@kirana-style/compiler-wasm32-wasi`, byte-identical output |

## Configuration keys in the specification but not the build

- `presets` — compose preset packages. Import preset modules directly instead.

It fails validation today. (`libraries` works: see
[publishing a library](/docs/advanced/libraries).) See the [roadmap](/docs/project/roadmap) for when they
are scheduled.
