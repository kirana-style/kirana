---
title: Installation
description: Set a project up with kirana-style init or your framework's guide, see what every setup has, and try unreleased changes from a checkout.
section: start
order: 4
keywords:
  [
    install,
    setup,
    frameworks,
    react,
    next.js,
    vue,
    svelte,
    astro,
    qwik,
    angular,
    preact,
    solid,
    tarballs,
    kirana-style init,
    kirana-style doctor,
  ]
---

# Installation

## Let `kirana-style init` do it

In your project's root, through your package manager's runner. It fetches the
command for this one run, the way `npx shadcn@latest` does, and writes nothing
until you say yes:

<!-- ::install run="kirana-style@latest init" -->

> [!NOTE] Right after a release
> Yarn and Deno hold back a version for its first 24 hours on npm, a guard against
> supply-chain attacks, and install the one before it meanwhile. To take a new
> release on its first day, pass Deno `--minimum-dependency-age=0`, or set Yarn's
> `npmMinimalAgeGate` lower.

It reads `package.json` and your lockfile, recognises the framework, bundler and
package manager, and shows every change it would make as a diff: the configuration
file, the adapter in your bundler's configuration, the stylesheet and the `sx`
types. Nothing is written until you say yes, and the install command is
printed for you to run (or pass `--install`). Then:

<!-- ::install exec="kirana-style doctor" -->

checks the engine, the installed versions, the configuration and the wiring, and
says what is missing. Both are described in [the CLI](/docs/tooling/cli#kirana-style-init).

`init` adds `kirana-style` to your dev dependencies, so every later command runs
the version your project pins: `npx kirana-style check`, `npx kirana-style build`
and the rest. [A shorter name](/docs/tooling/cli#a-shorter-name) is one script away.

## Pick your framework

Each guide takes you from an empty project to a styled component, and names the
example that CI builds and checks in a browser on every change.

<!-- ::frameworks -->

The overview of all of them, with what `sx` compiles to in each, is
[supported frameworks](/docs/frameworks/overview).

## Install by hand

The runtime package, the command line and your bundler's adapter (Vite here; your
[guide](#pick-your-framework) names yours):

<!-- ::install packages="@kirana-style/core" dev="kirana-style @kirana-style/vite" -->

## Machines without a native build

The engine is native code for {{fact:native-targets-word}} platforms. Anywhere else (a WebContainer, an
unusual CPU), install its WebAssembly build as well; Kirana uses it when no native
engine loads, and it writes exactly the same CSS, about twice as slowly:

```bash
npm install -D @kirana-style/compiler-wasm32-wasi --force
```

`KIRANA_FORCE_WASI=1` uses it even where the native engine works.

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

Every key is listed in the [configuration reference](/docs/reference/config).

### 3. The stylesheet entry

Kirana writes one stylesheet. Import it once, in your entry, before your own
global CSS, and the adapter fills it in:

```tsx file="src/main.tsx"
import "@kirana-style/core/stylesheet.css"
```

A framework that renders the whole document as a component, such as
[TanStack Start](/docs/frameworks/tanstack-start), links it from that component
instead:

<!-- prettier-ignore -->
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

The CSS Kirana writes runs in {{fact:browser-floor}} and later, the first
versions with `light-dark()`: every colour token is one `light-dark()` value, so
light and dark mode need no second stylesheet and no class to toggle. Every
current browser qualifies. To reach older ones, set
[`targets`](/docs/reference/config#targets) below that floor and the compiler
lowers what it can.

## Check it worked

```bash
# no diagnostics, exit code 0
npx kirana-style check src
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

## Unreleased changes

The published packages are the release. To try a change that is on `main` but not
released yet, use the packages from a checkout.

### From tarballs

A checkout packs every package the way it would be published, as compiled
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
    "@kirana-style/core": "file:/path/to/dist-packages/kirana-style-core-{{fact:version}}.tgz"
  },
  "devDependencies": {
    "kirana-style": "file:/path/to/dist-packages/kirana-style-{{fact:version}}.tgz",
    "@kirana-style/vite": "file:/path/to/dist-packages/kirana-style-vite-{{fact:version}}.tgz"
  },
  "overrides": {
    "@kirana-style/compiler": "file:/path/to/dist-packages/kirana-style-compiler-{{fact:version}}.tgz",
    "@kirana-style/rolldown": "file:/path/to/dist-packages/kirana-style-rolldown-{{fact:version}}.tgz",
    "@kirana-style/compiler-linux-x64-gnu": "file:/path/to/dist-packages/kirana-style-compiler-linux-x64-gnu-{{fact:version}}.tgz"
  }
}
```

pnpm reads the same map from `overrides` in `pnpm-workspace.yaml`, and Yarn from
`resolutions`. This is what CI does on every change: it installs the tarballs with
npm, pnpm, Yarn (both linkers) and Bun on Linux, macOS, Windows and Alpine, builds
an example, and checks its styles in a browser. No package runs an install script,
so there is nothing to allow-list.

> [!NOTE] Yarn needs every platform
> Yarn looks up every platform package to write its lockfile, even the ones it
> will not install. A tarball set packed on one machine has only that
> machine's, so use npm, pnpm or Bun there.

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
