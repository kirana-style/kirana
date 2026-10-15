# Installation
Source: https://kirana.style/docs/start/installation

# Installation

## Let `kirana init` do it

In your project's root:

```bash
npx kirana-style init
```

It reads `package.json` and your lockfile, recognises the framework, bundler and
package manager, and shows every change it would make as a diff: the configuration
file, the adapter in your bundler's configuration, the stylesheet and the `sx`
types. Nothing is written until you say yes, and the install command is
printed for you to run (or pass `--install`). Then:

```bash
npx kirana-style doctor
```

checks the engine, the installed versions, the configuration and the wiring, and
says what is missing. Both are described in [the CLI](/docs/tooling/cli#kirana-init).

The first run goes through `kirana-style`, the command line's package on npm.
After that the project has its own `kirana` command, which came with the compiler
the first run added, so the rest of these docs write `kirana check`, `kirana build` and so
on.

Until the packages are on npm, install `@kirana-style/compiler` from the tarballs
below first, and run its `kirana init` instead.

## Pick your framework

Each guide takes you from an empty project to a styled component, and names the
example that CI builds and checks in a browser on every change.

Frameworks:

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

Server frameworks:

- [Laravel](/docs/frameworks/laravel): The PHP framework for web artisans: @kirana in Blade.
- [Symfony](/docs/frameworks/symfony): The PHP framework for websites and apps: kirana() in Twig.
- [Ruby on Rails](/docs/frameworks/rails): The full-stack Ruby framework: a kirana helper in ERB views.
- [Phoenix](/docs/frameworks/phoenix): Rich, interactive Elixir apps: kirana/1 in HEEx templates.
- [AdonisJS](/docs/frameworks/adonisjs): The fully featured Node.js framework: kirana() in Edge.

Bundlers:

- [Vite](/docs/integrations/vite): The build tool most frameworks run on, with hot style updates.
- [Rolldown](/docs/integrations/rolldown): The Rust bundler under Vite, on its own.
- [webpack](/docs/integrations/webpack): A pre loader for sx and a plugin that writes the stylesheet.
- [Rspack and Rsbuild](/docs/integrations/rspack): The fast Rust-based web bundler, and its build tool.
- [Parcel](/docs/integrations/parcel): The zero-configuration build tool for the web.
- [Bun](/docs/integrations/bun): Bun's bundler and its dev server, from one plugin.
- [esbuild](/docs/integrations/esbuild): An extremely fast bundler, in watch and serve modes too.
- [PostCSS](/docs/integrations/postcss): The project's stylesheet wherever @kirana; stands.
- [Jest](/docs/integrations/jest): A transformer, so tests see the class names you ship.

The overview of all of them, with what `sx` compiles to in each, is
[supported frameworks](/docs/frameworks/overview).

## Not on npm yet

The packages (`@kirana-style/core`, the compiler, and one adapter per host) are at
version 0.1.0 and **not published**: the API is still moving and the name is not
cleared. Two ways work today; the guides are the same for both.

### Install from tarballs

A checkout can pack every package the way it would be published, as compiled
JavaScript with declarations and the engine as its own per-platform package:

```bash
vp run engine          # the engine for this machine
bun run kirana:pack    # tarballs in packages/kirana/dist-packages
```

Point your project at those tarballs, including the ones it does not name itself,
through your package manager's overrides. With npm or Bun:

```json file="package.json"
{
  "dependencies": {
    "@kirana-style/core": "file:/path/to/dist-packages/kirana-core-0.1.0.tgz"
  },
  "devDependencies": {
    "@kirana-style/vite": "file:/path/to/dist-packages/kirana-vite-0.1.0.tgz"
  },
  "overrides": {
    "@kirana-style/compiler": "file:/path/to/dist-packages/kirana-compiler-0.1.0.tgz",
    "@kirana-style/rolldown": "file:/path/to/dist-packages/kirana-rolldown-0.1.0.tgz",
    "@kirana-style/compiler-linux-x64-gnu": "file:/path/to/dist-packages/kirana-compiler-linux-x64-gnu-0.1.0.tgz"
  }
}
```

pnpm reads the same map from `overrides` in `pnpm-workspace.yaml`, and Yarn from
`resolutions`. This is exactly what CI does on every change: it installs the
tarballs with npm, pnpm, Yarn (both linkers) and Bun on Linux, macOS, Windows and
Alpine, builds an example, and checks its styles in a browser. No package runs an
install script, so there is nothing to allow-list.

> [!NOTE] Yarn needs every platform
> Yarn looks up all eight platform packages to write its lockfile, even the seven
> it will not install. A tarball set packed on one machine has only that
> machine's, so use npm, pnpm or Bun there.

### Machines without a native build

The engine is native code for eight platforms. Anywhere else (a WebContainer, an
unusual CPU), install its WebAssembly build as well; Kirana uses it when no native
engine loads, and it writes exactly the same CSS, about twice as slowly:

```bash
npm install -D @kirana-style/compiler-wasm32-wasi --force
```

`KIRANA_FORCE_WASI=1` uses it even where the native engine works.

### From a checkout of the repository

Kirana lives in a Bun workspace alongside the apps that use it. In that setup an
app depends on the packages by workspace protocol:

```json file="apps/your-app/package.json"
{
  "dependencies": {
    "@kirana-style/core": "workspace:*"
  },
  "devDependencies": {
    "@kirana-style/vite": "workspace:*"
  }
}
```

To use Kirana from a project outside the repository, link the packages from a
checkout:

```bash
cd kirana/packages/kirana/npm/core && bun link
cd ../vite && bun link
cd /your/project && bun link @kirana-style/core @kirana-style/vite
```

The native engine comes from the checkout's build (`vp run build` there, or
`vp run engine`).

### Once published

Once the packages are released, installation becomes the ordinary thing. Do not
run this yet: the registry has nothing to give you.

```bash
npm install @kirana-style/core
npm install -D @kirana-style/vite
```

## What every setup has

The guides differ in names, not in shape. Whatever the framework, a project needs
the same four things.

### 1. The bundler plugin

Kirana compiles modules, so it runs in the bundler, ahead of the framework's own
plugin. Here it is for React on Vite 8; the [guides](#pick-your-framework) show it
for every other framework and bundler.

```ts file="vite.config.ts"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import kirana from "@kirana-style/vite"

export default defineConfig({
  // Kirana goes before the framework plugins, so they only ever see compiled
  // JavaScript.
  plugins: [kirana(), react()],
})
```

### 2. The configuration file

`kirana.config.ts` sits in the project root. It is optional, since every key has a
default, but this is where layers, targets and diagnostic levels live.

```ts file="kirana.config.ts"
import { defineConfig } from "@kirana-style/core/config"

export default defineConfig({
  // Your own layers, placed below every Kirana rule.
  layers: { before: ["reset", "base"] },
})
```

Every key is listed in the [configuration reference](/docs/config/reference).

### 3. The stylesheet entry

Kirana writes one stylesheet. Import it once, in your entry, before your own
global CSS, and the adapter fills it in:

```tsx file="src/main.tsx"
import "@kirana-style/core/stylesheet.css"
```

A framework that renders the whole document as a component, such as
[TanStack Start](/docs/frameworks/tanstack-start), links it from that component
instead:

```tsx file="root.tsx"
import kiranaCss from "@kirana-style/core/stylesheet.css?url"

// Before your own global stylesheet: its `@layer reset, base, kirana`
// statement fixes the layer order.
<link rel="stylesheet" href={kiranaCss} />
```

Your framework's guide shows which of the two it uses.

In development the adapter serves the live stylesheet and updates it over HMR. In
a production build it replaces the placeholder rule and renames the file to a
content hash.

### 4. The `sx` prop's types

`sx` is not an import: the compiler recognises it on any element in a module it
compiles. TypeScript needs one reference to know about it:

```ts file="src/types.d.ts"
/// <reference types="@kirana-style/core/react" />
```

Put it in a `.d.ts` file that your `tsconfig.json` includes, and every host
element accepts `sx`.

The other frameworks have their own entry, such as `@kirana-style/core/vue`, and
each guide names the one to use. Angular needs none: the `[sx]` directive carries
its type.

## Browsers

The CSS Kirana writes runs in Chrome 123, Safari 17.5, Firefox 120 and later, the first
versions with `light-dark()`: every colour token is one `light-dark()` value, so
light and dark mode need no second stylesheet and no class to toggle. Every
current browser qualifies. To reach older ones, set
[`targets`](/docs/config/reference#targets) below that floor and the compiler
lowers what it can.

## Check it worked

```bash
# no diagnostics, exit code 0
kirana check src
```

If a module that uses `css()` was never compiled, calling it throws at runtime
with a message that says exactly that: the failure is loud, never a silently
unstyled page.

> [!TIP] Troubleshooting
> **Styles missing in development?** The stylesheet entry must be imported, and
> `kirana()` must come before the framework plugin.
> **`unresolved-import` warnings?** The compiler follows imports to find token
> and style definitions; check the specifier and your `tsconfig.json` paths.
> **A component ignores `sx`?** Components from installed packages do not read it.
> Spread the compiled props instead; see
> [styling other people's components](/docs/styling/external-components).
