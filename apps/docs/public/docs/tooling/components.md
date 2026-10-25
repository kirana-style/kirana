# Installing components
Source: https://kirana.style/docs/tooling/components

# Installing components

`kirana-style ui` copies components from a registry into your project, as
shadcn/ui's CLI does: the files become yours. It installs one source for every
framework, rewrites its imports to your aliases, adds the packages it needs, and
records what it wrote so it can update it later without losing your edits.

The commands live in their own package:

```bash
npm install --save-dev @kirana-style/registry
```

## Setting a project up

```bash
npx kirana-style ui init
```

`init` works on a new app or one you already have:

- it sets Kirana up where the project lacks it, as `kirana-style init` does;
- it maps the `@/*` alias in `tsconfig.json` when the project has none, and tells
  Vite to read it;
- it installs the registry's design system and wires it in: its configuration in
  `kirana.config.ts`, its reset beside Kirana's stylesheet, its styles on
  `<html>`.

To start from nothing, take one of Kirana's examples, as the release you run has
it:

```bash
npx kirana-style ui init --template vite-react my-app
```

Name the framework or the base when the project depends on more than one, or a
component has several:

```bash
npx kirana-style ui init --framework react --base aria
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

## The lockfile

`kirana-style.lock.json` records each installed component: the registry it came
from, its version, the framework and base, and for each file two hashes. One is
of the registry's content, the other of what was written. Commit it.

The two hashes are how the later commands tell the registry's change from yours:

```bash
npx kirana-style ui outdated
npx kirana-style ui diff button
```

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
