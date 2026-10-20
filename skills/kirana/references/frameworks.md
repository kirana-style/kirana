<!-- Condensed from https://kirana.style/docs/frameworks/overview.md and the framework guides. -->

# Frameworks

`npx kirana-style@latest init` detects the framework, bundler and package manager and shows every change as a
diff before writing it; `npx kirana-style doctor` checks the result. Each app imports
`@kirana-style/core/stylesheet.css` once. Installation by hand, per package manager:
https://kirana.style/docs/start/installation.md.

| Framework                                                       | Adapter (dev dependency unless noted)                                                 | `sx` in markup                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| React, React Router, TanStack Start, Preact, Solid, Qwik (Vite) | `@kirana-style/vite`                                                                  | `<div sx={[a, b]} />` (compiles to `className` or `class`) |
| Next.js                                                         | `@kirana-style/next` + `@kirana-style/postcss` (Turbopack) or `@kirana-style/webpack` | `<div sx={a} />`                                           |
| Vue, Nuxt                                                       | `@kirana-style/vite`                                                                  | `<div :sx="[a, b]">`                                       |
| Svelte, SvelteKit                                               | `@kirana-style/vite` (before `sveltekit()`)                                           | `<div sx={[a, b]}>`                                        |
| Astro                                                           | `@kirana-style/astro`                                                                 | `<div sx={[a, b]}>`                                        |
| Angular                                                         | `@kirana-style/angular` (dependency); Analog adds `@kirana-style/vite`                | `[sx]="[styles.card, wide() && styles.wide]"` directive    |
| Ember (Embroider + Vite)                                        | `@kirana-style/ember` (dependency) + `@kirana-style/vite`                             | `class={{sx styles.card (if @active styles.active)}}`      |
| Gatsby                                                          | `@kirana-style/gatsby`                                                                | `<h1 sx={a}>`                                              |
| Meteor 3.4+                                                     | `@kirana-style/rspack`                                                                | `<h1 sx={a}>`                                              |
| No framework                                                    | `@kirana-style/vite` or a bundler adapter                                             | `element.className = String(cx(a, b))` (later handles win) |

Bundlers without a framework: `@kirana-style/vite`, `@kirana-style/rolldown`, `@kirana-style/webpack`,
`@kirana-style/rspack` (also Rsbuild), `@kirana-style/bun`, `@kirana-style/esbuild`, `@kirana-style/parcel-transformer`;
`@kirana-style/jest` for tests.

## Server templates

Styles live in TypeScript modules listed in `classes.modules` of `kirana.config.ts`; the CLI
(`kirana-style dev` beside the server, `kirana-style build` in deploys) writes the stylesheet and a class map the
template helper reads. A style a template names must be a static export (`classes-not-static`,
`unknown-class-name` otherwise).

| Framework     | Template | Helper                                                              |
| ------------- | -------- | ------------------------------------------------------------------- |
| Laravel       | Blade    | `@kirana('card', $active ? 'active' : null)`                        |
| Symfony       | Twig     | `{{ kirana('card', active ? 'active') }}`                           |
| Ruby on Rails | ERB      | `<%= kirana :card, active && :active %>`                            |
| Phoenix       | HEEx     | `class={kirana(["card", @active && "active"])}`                     |
| AdonisJS      | Edge     | `{{ kirana('card', active && 'active') }}` (`@kirana-style/adonis`) |
