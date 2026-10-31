# Installing components
Source: https://site.kirana-style.workers.dev/docs/tooling/components

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
- it maps the `@/*` alias in `tsconfig.json` when the project has none, and tells
  Vite to read it; a JavaScript Next.js app gets the `tsconfig.json` Next.js
  would write, and TypeScript, since the components are TypeScript;
- it installs the registry's design system and wires it in: its configuration in
  `kirana.config.ts`, its reset beside Kirana's stylesheet, its styles on
  `<html>`.

To start from nothing, take one of Kirana's examples, as the release you run has
it:

```bash
npx @kirana-style/registry init --template vite-react my-app
```

The project it makes runs `kirana-style ui` by itself: `init` adds
`@kirana-style/registry` beside Kirana's other packages, each at the release you
ran, written as that exact version.

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

| Where `<html>` is              | Templates                                         | `init` does         |
| ------------------------------ | ------------------------------------------------- | ------------------- |
| the one layout that renders it | Next.js, React Router, TanStack Start, SolidStart | sets the attributes |
| `index.html`                   | Vite, Parcel, Bun, Ember, Analog                  | sets the attributes |
| `src/index.html`               | Angular CLI                                       | sets the attributes |
| `src/app.html`                 | SvelteKit                                         | sets the attributes |
| elsewhere, or in two layouts   | Nuxt, Astro, Laravel, Rails                       | prints them to set  |

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

`add` never changes a file you already have unless you pass `--overwrite`.
`--dry-run` shows what it would do.

Each command that writes components ends by checking the scripts it wrote with
Kirana. `--no-check` skips that, for a project whose configuration cannot load
until its packages are installed.

A font (`ui add font-lora`) is a package and the stylesheet that loads it, which
`add` imports after Kirana's stylesheet.

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
your own.
