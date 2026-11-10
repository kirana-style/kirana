---
title: Installing components
description: Set a project up for a component registry, add components, and keep them up to date with kirana-style ui.
section: tooling
order: 6
keywords: [components, registry, install, add, init, update, lockfile, shadcn]
---

# Installing components

`kirana-style ui` copies components from a registry into your project, as
shadcn/ui's CLI does: the files become yours. It installs one source for every
framework, rewrites its imports to your aliases, adds the packages it needs, and
records what it wrote so it can update it later without losing your edits.

The commands live in their own package:

```bash
npm install --save-dev @kirana-style/registry
```

In a folder with nothing installed yet, the package runs on its own, as
`npx @kirana-style/registry <command>`, the same commands under another name.

## Setting a project up

```bash
npx kirana-style ui init
```

`init` works on a new app or one you already have:

- it sets Kirana up where the project lacks it, as `kirana-style init` does;
- it maps the `@/*` alias in `tsconfig.json` when the project has none, inside
  what that tsconfig compiles, and tells Vite to read it;
- it installs the registry's design system and wires it in: its configuration in
  `kirana.config.ts`, its reset beside Kirana's stylesheet, its styles on
  `<html>`.

Where the alias points, and what `init` writes for it, follows the framework:

| Project                          | `@/*` points to | `init` writes                                                                                                           |
| -------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Vite, TanStack Start, SolidStart | `src/`          | `paths` in the tsconfig, `resolve.tsconfigPaths` in Vite's configuration                                                |
| React Router                     | `app/`          | the same: its tsconfig compiles `app`, not the project's root                                                           |
| Astro                            | `src/`          | `paths` in the tsconfig, which Astro resolves itself                                                                    |
| Laravel with Inertia             | `resources/js/` | nothing: its starter's tsconfig maps `@/*` there, as `laravel-vite-plugin` does                                         |
| JavaScript Next.js               | the root        | the `tsconfig.json` Next.js would write, and TypeScript, since the components are TypeScript                            |
| Nuxt                             | `app/`          | Nuxt's own alias: the `tsconfig.json` Nuxt's starter has, and its `postinstall`, `nuxt prepare`, which writes the rest  |
| SvelteKit                        | `src/`          | the `tsconfig.json` SvelteKit's starter has, with `paths` and its `.svelte` files, and its `prepare`, `svelte-kit sync` |

Around the alias, `init` also:

- adds to the tsconfig's `include` the folders it leaves out, and Vue or Svelte
  files where its patterns take scripts only: Vite resolves no alias in a file
  its tsconfig does not compile;
- runs Nuxt's or SvelteKit's script once the packages are in, since each writes
  the tsconfig the project's extends on its first run; every later `ui` command
  that installs packages runs it again, since an install can remove what it
  wrote;
- lists the reset beside Kirana's stylesheet in the `css` of `nuxt.config.ts`,
  where Nuxt has it, and imports it in the `<script>` of SvelteKit's
  `src/routes/+layout.svelte`, where SvelteKit imports Kirana's stylesheet; a
  font a design names goes in the same place.

To start from nothing, take one of Kirana's examples, as the release you run has
it:

```bash
npx @kirana-style/registry init --template vite-react my-app
```

The project it makes runs `kirana-style ui` by itself: `init` adds
`@kirana-style/registry` beside Kirana's other packages, each at the release you
ran, written as that exact version.

A registry can offer its own templates, an app with its tooling or a workspace
around it, by name or by an archive's URL:

```bash
npx @kirana-style/registry init --template @acme/vite-react--turbo my-app --registry @acme=https://acme.dev/r/{name}.json
npx @kirana-style/registry init --template https://acme.dev/r/templates/shop.tgz
```

`init` unpacks the template, installs it with the package manager you ran it
with, written as the root's `packageManager` where the template asks, and goes on
in the app the template names (`apps/web` in a workspace) as in any project.
`--dry-run` cannot start from a template. How a registry lists them is in
[publishing a registry](/docs/tooling/registries#templates).

Start with a design by its preset code, which a design system's site gives you:

```bash
npx kirana-style ui init --preset k2bS6
```

Name the framework or the base when the project depends on more than one, or a
component has several:

```bash
npx kirana-style ui init --framework react --base aria
```

Turn on the pointer cursor on buttons, or right to left, with the flags
shadcn/ui's `init` takes:

```bash
npx kirana-style ui init --pointer --rtl
```

| Flag        | Writes on `<html>` | What follows from it                                                    |
| ----------- | ------------------ | ----------------------------------------------------------------------- |
| `--pointer` | `data-pointer`     | the design system's reset gives every enabled button the pointer cursor |
| `--rtl`     | `dir="rtl"`        | every logical property in the components turns round                    |

A component library that reads the direction from a provider needs it too, as
Base UI and React Aria do; `init` prints that as a step by hand.

Both go in the project's root document, found in this order:

| Where `<html>` is                       | Templates                                                | `init` does         |
| --------------------------------------- | -------------------------------------------------------- | ------------------- |
| the one layout that renders it          | Next.js, React Router, TanStack Start, SolidStart, Astro | sets the attributes |
| the one component that renders `<Html>` | Nuxt, `app.vue` given a `<Html />` where none has one    | sets the attributes |
| `index.html`                            | Vite, Parcel, Bun, Ember, Analog                         | sets the attributes |
| `src/index.html`                        | Angular CLI                                              | sets the attributes |
| `src/app.html`                          | SvelteKit                                                | sets the attributes |
| `resources/views/app.blade.php`         | Laravel with Inertia                                     | sets the attributes |
| elsewhere, or in two layouts            | Rails, Laravel's own Blade views                         | prints them to set  |

The design system's styles for `<html>` go:

- on the same element as `sx`, or as `:sx` on Nuxt's `<Html>`, imported in the
  component's script;
- on Vite, from the entry, before the app renders, since a static page cannot
  take `sx`;
- on SvelteKit, whose `src/app.html` is static, from the server hook `init`
  writes, `src/hooks.server.ts`, which adds the classes to every page it renders.
  A project with a hook of its own is told what to add to it.

Neither is kept in the `ui` settings: the components need no rewriting for
them, so `<html>` is the one place that says what the project has. On a project
already set up, `preset` takes the same flags, and their `--no-` forms take one
off:

```bash
npx kirana-style ui preset k2bS6 --pointer
```

## Adding components

```bash
npx kirana-style ui add button dialog
```

Each component comes with the components it needs, in order. Its files land under
your alias for their type, `@/components/ui` for components by default, and its
icons are drawn with your icon library. The packages it needs are installed with
your package manager, and Kirana checks what was written before your next build.

<!-- consistency: subset -->

It installs on React, Vue, Svelte, Solid and Angular, each component's markup for
your framework and base. An icon is your library's own component where the
library has a package for your framework:

<!-- consistency: subset -->

| Icon library | React, Vue | Svelte  | Solid   | Angular |
| ------------ | ---------- | ------- | ------- | ------- |
| Lucide       | package    | package | package | inline  |
| Tabler       | package    | package | package | inline  |
| Hugeicons    | package    | package | inline  | inline  |
| Phosphor     | package    | package | inline  | inline  |
| Remix Icon   | package    | inline  | inline  | inline  |

Elsewhere it is written into the file as an inline `<svg>`, read at install from
the library's own published data at the version your Kirana release names, and
the file keeps the library's licence notice in a comment. An Angular component
gets the `<svg>` in its template in place of the placeholder directive, which is
dropped from its imports.

`add` never changes a file you already have unless you pass `--overwrite`.
`--dry-run` shows what it would do.

Each command that writes components ends by checking the scripts it wrote with
Kirana. `--no-check` skips that, for a project whose configuration cannot load
until its packages are installed.

A font (`ui add font-lora`) is a package and the stylesheet that loads it, which
`add` imports after Kirana's stylesheet.

## In a monorepo

In a Turborepo or any other workspace, the components can live in a package that
every app imports, as shadcn/ui's monorepo template has them. Run `init` in the
app, with the package's folder from the workspace's root:

```bash
cd apps/web
npx kirana-style ui init --workspace packages/ui
```

The package needs a `package.json` with its name. Its aliases start with that
name, so the app imports `@workspace/ui/components/button`. `init` makes the
package a Kirana project and wires the app to it:

| Folder        | What `init` writes there                                                                                                                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui` | `kirana.config.ts` with the `ui` settings and the design system's configuration; `"@workspace/ui/*": ["./src/*"]` in its tsconfig, or a tsconfig with the app's JSX options; the components, their packages and the lockfile |
| `apps/web`    | Kirana's own setup; `ui.workspace` and the same configuration in its `kirana.config.ts`; `"@workspace/ui/*": ["../../packages/ui/src/*"]` in its tsconfig, read by Vite; the reset and the `<html>` styles in its entry      |

```ts file="apps/web/kirana.config.ts"
import { defineConfig } from "@kirana-style/core/config"
import { installConfig } from "../../packages/ui/src/lib/kirana/kirana.ts"

export default defineConfig({
  ...installConfig,
  ui: { workspace: "../../packages/ui" },
})
```

Every later command run in the app reads `ui.workspace` and works on the package:

```bash
npx kirana-style ui add button
```

- the button lands in `packages/ui/src/components`, and its packages are
  installed in the package;
- the package's lockfile records it, and the package's configuration checks it;
- a font, and the attributes `preset` sets, still go into the app, which loads
  the stylesheets and renders `<html>`.

The app's `ui` holds `workspace` alone. The other settings are the package's, a
registry given as a path among them.

The app's build compiles the package's files with the app's configuration,
which is why both spread the design system's. Run from the workspace's root,
`kirana-style check apps/web/src packages/ui/src` reads each folder's own, as
the lint plugin does when `settings.kirana.root` is left unset.

## The lockfile

`kirana-style.lock.json` records each installed component: the registry it came
from, its version, the framework and base, and for each file two hashes. One is
of the registry's content, the other of what was written. Commit it.

The two hashes are how the later commands tell the registry's change from yours:

```bash
npx kirana-style ui outdated
npx kirana-style ui diff button
```

## Changing the design

A design system says which axes it has (a style, a base colour, a radius …) and
how a preset code holds them. Give a code to `init`, or change it later:

```bash
npx kirana-style ui preset k2bS6
```

`preset` writes the design to `ui.design` and sets its attributes on `<html>`,
where your design system's styles are. Then it places every installed component
again: a registry that flattened its style modules for the new design gives you
that build, with only the new style's values in it. So do its colours, fonts and
radius, where the registry built them for each value. A file you changed stops it
until you look, or pass `--overwrite`.

To keep every design installed instead, for a theme switcher of your own, start
with `--all-designs`:

```bash
npx kirana-style ui init --preset k2bS6 --all-designs
```

It sets `ui.allDesigns`, and every later `add`, `update` and `preset` installs the
files as written, with every design in them. Icons stay your one library.

When a code picks a font the project does not have, it is installed, as `init`
installs the fonts its code names. A font no axis uses any more stays, and the
command says so.

## Updating and removing

```bash
npx kirana-style ui update
```

`update` writes what the registry changed and keeps what you changed. Where both
of you changed the same file, it stops before writing anything: `ui diff` shows
the two sides, and `--overwrite` takes the registry's. A registry that changes a
component's files without a new version is refused.

```bash
npx kirana-style ui remove dialog
```

`remove` deletes the files you left as they were installed and keeps the ones you
changed. It refuses a component another installed one still needs.

## Your registries

Kirana UI's registry is known as `@kirana`. Name others in `kirana.config.ts`,
under [`ui.registries`](/docs/reference/config#ui), and install from them by
namespace:

```bash
npx kirana-style ui add @acme/card
```

[Publishing a registry](/docs/tooling/registries) describes the format, for
your own, and `ui build`, which writes it from your sources. An AI assistant can
search and install from your registries through
[`kirana-style ui mcp`](/docs/tooling/mcp).
