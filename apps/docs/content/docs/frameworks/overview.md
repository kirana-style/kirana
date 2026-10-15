---
title: Choose a framework
description: Install Kirana with your framework, on your bundler, or from the command line for server templates, with a guide for each that is tested on every change.
section: frameworks
order: 1
keywords:
  [
    get started,
    installation,
    frameworks,
    bundlers,
    support,
    react,
    next.js,
    vue,
    svelte,
    angular,
    laravel,
    rails,
    phoenix,
    symfony,
    vite,
    cli,
  ]
---

# Choose a framework

Kirana compiles the styles you write next to your components into class names
and one static stylesheet, with no styling runtime left in the page. It works
with every major framework and bundler, and with server-rendered templates
through the command line.

<!-- ::start:tabs -->

## Framework guides

Guides for each framework, covering the recommended way to install Kirana in it.
Each is complete on its own: install, configure, import the stylesheet, type
`sx`, write a component.

<!-- ::guides group="frameworks" -->

<!-- ::guides group="server" title="Server frameworks" -->

> [!NOTE] Don't see your framework?
> Most frameworks build with Vite: use [the Vite plugin](/docs/integrations/vite).
> Otherwise, pick [your bundler](/docs/integrations/bundlers), or let
> [the Kirana CLI](/docs/tooling/cli#kirana-dev) write the stylesheet and a
> [class map](/docs/frameworks/server-templates) for your templates.

## Using Vite

Kirana's Vite plugin compiles styles as Vite loads each module and keeps the
stylesheet live in development. Every Vite-based framework uses it.

### 1. Install

<!-- ::install packages="@kirana-style/core" dev="@kirana-style/vite" -->

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

<!-- ::guides group="bundlers" -->

## Kirana CLI

For server-rendered templates (Blade, ERB, HEEx, Twig, Edge) and anything else
without a bundler. You write styles in TypeScript modules; the CLI writes the
stylesheet, and a class map your templates read the class names from.

### 1. Install

<!-- ::install dev="@kirana-style/compiler @kirana-style/core" -->

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

<!-- ::end:tabs -->

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
