# Choose a framework
Source: https://kirana.style/docs/frameworks/overview

# Choose a framework

Kirana compiles the styles you write next to your components into class names
and one static stylesheet, with no styling runtime left in the page. It works
with every major framework and bundler, and with server-rendered templates
through the command line.



## Framework guides

Guides for each framework, covering the recommended way to install Kirana in it.
Each is complete on its own: install, configure, import the stylesheet, type
`sx`, write a component.

- [React](/docs/frameworks/react): The library for web and native user interfaces, on Vite.
- [Next.js](/docs/frameworks/nextjs): The React framework, with server components, on Turbopack.
- [React Router](/docs/frameworks/react-router): A standards-focused router and framework you can deploy anywhere.
- [TanStack Start](/docs/frameworks/tanstack-start): Full-stack React powered by TanStack Router. This site runs on it.
- [Gatsby](/docs/frameworks/gatsby): Static sites with React and GraphQL, built by webpack.
- [Preact](/docs/frameworks/preact): A fast 3 kB alternative to React with the same API.
- [Solid](/docs/frameworks/solid): Simple, performant reactivity for user interfaces.
- [Vue](/docs/frameworks/vue): The progressive framework, with :sx in single-file components.
- [Nuxt](/docs/frameworks/nuxt): The intuitive Vue framework for universal applications.
- [Svelte](/docs/frameworks/svelte): Cybernetically enhanced web apps, with sx on elements.
- [SvelteKit](/docs/frameworks/sveltekit): The fastest way to build apps of all sizes with Svelte.
- [Astro](/docs/frameworks/astro): The web framework for content-driven sites, sx in .astro files.
- [Qwik](/docs/frameworks/qwik): Instantly interactive apps, rendered on the server and resumed.
- [Angular](/docs/frameworks/angular): The platform for web apps, with an [sx] directive in templates.
- [Ember.js](/docs/frameworks/ember): A framework for ambitious web apps, on Embroider and Vite.
- [Meteor](/docs/frameworks/meteor): The full-stack JavaScript platform for web and mobile apps.
- [No framework](/docs/frameworks/vanilla): Plain TypeScript and web components: handles are class strings.

- [Laravel](/docs/frameworks/laravel): The PHP framework for web artisans: @kirana in Blade.
- [Symfony](/docs/frameworks/symfony): The PHP framework for websites and apps: kirana() in Twig.
- [Ruby on Rails](/docs/frameworks/rails): The full-stack Ruby framework: a kirana helper in ERB views.
- [Phoenix](/docs/frameworks/phoenix): Rich, interactive Elixir apps: kirana/1 in HEEx templates.
- [AdonisJS](/docs/frameworks/adonisjs): The fully featured Node.js framework: kirana() in Edge.

> [!NOTE] Don't see your framework?
> Most frameworks build with Vite: use [the Vite plugin](/docs/integrations/vite).
> Otherwise, pick [your bundler](/docs/integrations/bundlers), or let
> [the Kirana CLI](/docs/tooling/cli#kirana-dev) write the stylesheet and a
> [class map](/docs/frameworks/server-templates) for your templates.

## Using Vite

Kirana's Vite plugin compiles styles as Vite loads each module and keeps the
stylesheet live in development. Every Vite-based framework uses it.

### 1. Install

```bash
npm install @kirana-style/core
npm install -D @kirana-style/vite
```

### 2. Add the plugin

```ts file="vite.config.ts"
import kirana from "@kirana-style/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({ plugins: [kirana(), react()] })
```

### 3. Import the stylesheet

```ts file="src/main.tsx"
import "@kirana-style/core/stylesheet.css"
```

### 4. Write a component

```tsx file="src/card.tsx"
import { css } from "@kirana-style/core"

const card = css({ padding: "1rem", borderRadius: "0.5rem" })

export const Card = () => <div sx={card} />
```

The [Vite guide](/docs/integrations/vite) has the options, and each framework's
guide its own line in `vite.config.ts`.

## Bundlers

One adapter for each bundler. Every one hands the modules that carry styles to
the same compiler, so the class names and the stylesheet are the same whichever
one builds them.

- [Vite](/docs/integrations/vite): The build tool most frameworks run on, with hot style updates.
- [Rolldown](/docs/integrations/rolldown): The Rust bundler under Vite, on its own.
- [webpack](/docs/integrations/webpack): A pre loader for sx and a plugin that writes the stylesheet.
- [Rspack and Rsbuild](/docs/integrations/rspack): The fast Rust-based web bundler, and its build tool.
- [Parcel](/docs/integrations/parcel): The zero-configuration build tool for the web.
- [Bun](/docs/integrations/bun): Bun's bundler and its dev server, from one plugin.
- [esbuild](/docs/integrations/esbuild): An extremely fast bundler, in watch and serve modes too.
- [PostCSS](/docs/integrations/postcss): The project's stylesheet wherever @kirana; stands.
- [Jest](/docs/integrations/jest): A transformer, so tests see the class names you ship.

## Kirana CLI

For server-rendered templates (Blade, ERB, HEEx, Twig, Edge) and anything else
without a bundler. You write styles in TypeScript modules; the CLI writes the
stylesheet, and a class map your templates read the class names from.

### 1. Install

```bash
npm install -D @kirana-style/compiler @kirana-style/core
```

### 2. Name the modules templates use

```ts file="kirana.config.ts"
import { defineConfig } from "@kirana-style/core/config"

export default defineConfig({
  classes: { modules: ["styles"], out: "public/kirana/classes.json" },
})
```

### 3. Write styles

```ts file="styles/app.styles.ts"
import { css } from "@kirana-style/core"

export const card = css({ padding: "1rem", borderRadius: "0.5rem" })
```

### 4. Run it

```bash
npx kirana dev styles --out public/kirana/kirana.css
```

`kirana dev` watches and rewrites both files; `kirana build` writes them once,
minified with `--minify`. Your template helper then turns `card` into its class
names; see [server templates](/docs/frameworks/server-templates).



## Every guide is a test

Every example lives in `packages/kirana/examples/`. On every change, CI packs the
packages, installs each example from the tarballs, builds it, and checks a styled
element's computed style and hover in a browser. It also starts each dev server
and checks that a style edit reaches the page in place, without a reload, where
the framework updates components that way. A row in this table is a test that
passes, not a claim.

| Guide                                             | Runs on                    | `sx` becomes                     | Tested example                   |
| ------------------------------------------------- | -------------------------- | -------------------------------- | -------------------------------- |
| [React](/docs/frameworks/react)                   | Vite                       | `className` and `style`          | `vite-react`                     |
| [Next.js](/docs/frameworks/nextjs)                | Turbopack, webpack         | `className` and `style`          | `next-turbopack`, `next-webpack` |
| [React Router](/docs/frameworks/react-router)     | Vite                       | `className` and `style`          | `react-router`                   |
| [TanStack Start](/docs/frameworks/tanstack-start) | Vite                       | `className` and `style`          | this site                        |
| [Gatsby](/docs/frameworks/gatsby)                 | webpack                    | `className` and `style`          | `gatsby`                         |
| [Preact](/docs/frameworks/preact)                 | Vite                       | `class` and `style`              | `vite-preact`                    |
| [Solid](/docs/frameworks/solid)                   | Vite                       | `class` and `style`              | `vite-solid`                     |
| [Vue](/docs/frameworks/vue)                       | Vite                       | `:sx` → `class` and `style`      | `vite-vue`                       |
| [Nuxt](/docs/frameworks/nuxt)                     | Nuxt (Vite)                | `:sx` → `class` and `style`      | `nuxt`                           |
| [Svelte](/docs/frameworks/svelte)                 | Vite                       | `sx` → `class` and `style`       | `vite-svelte`                    |
| [SvelteKit](/docs/frameworks/sveltekit)           | Vite                       | `sx` → `class` and `style`       | `sveltekit`                      |
| [Astro](/docs/frameworks/astro)                   | Astro (Vite)               | `sx` → `class` and `style`       | `astro`                          |
| [Qwik](/docs/frameworks/qwik)                     | Qwik Router (Vite)         | `class` and `style`              | `qwik`                           |
| [Angular](/docs/frameworks/angular)               | Angular CLI, Analog (Vite) | `[sx]` directive (runtime merge) | `angular-cli`, `analog-angular`  |
| [Ember.js](/docs/frameworks/ember)                | Embroider (Vite)           | `cx` in templates                | `ember`                          |
| [Meteor](/docs/frameworks/meteor)                 | Meteor (Rspack)            | `className` and `style`          | `meteor`                         |
| [No framework](/docs/frameworks/vanilla)          | Vite                       | a class string you assign        | `vite-vanilla`                   |
| [Laravel](/docs/frameworks/laravel)               | Kirana CLI, Vite           | `@kirana(…)` in Blade            | `laravel`                        |
| [Symfony](/docs/frameworks/symfony)               | Kirana CLI, AssetMapper    | `kirana(…)` in Twig              | `symfony`                        |
| [Ruby on Rails](/docs/frameworks/rails)           | Kirana CLI, Propshaft      | `kirana` in ERB                  | `rails`                          |
| [Phoenix](/docs/frameworks/phoenix)               | Kirana CLI                 | `kirana/1` in HEEx               | `phoenix`                        |
| [AdonisJS](/docs/frameworks/adonisjs)             | Kirana CLI, Vite           | `kirana(…)` in Edge              | `adonisjs`                       |

The bundlers have their own examples, listed on [each page](/docs/integrations/bundlers).
