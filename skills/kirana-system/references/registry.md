<!-- Condensed from https://kirana.style/docs/tooling/registries.md, tooling/components.md and tooling/cli.md; those pages are the source of truth. -->

# Registries

A registry is static JSON anyone can host: one document per item at a URL template holding `{name}`,
and an index (the item named `index`). The schemas are exported by `@kirana-style/registry/schema`
and served at their ids, which a document names in `$schema`:
`https://kirana.style/schema/registry-item.json`, `registry-index.json`, `registry-templates.json`,
`lockfile.json` and `settings.json` (the consumer's `ui` key).

## The source, `registry.json`

```json
{
  "name": "Acme",
  "homepage": "https://acme.dev",
  "defaultBase": { "react": "base" },
  "items": [
    {
      "name": "kit",
      "type": "design-system",
      "version": "1.0.0",
      "files": [
        "src/lib/tokens/scales.ts",
        "src/lib/tokens/theme.ts",
        "src/lib/tokens/context.ts",
        "src/lib/kit/config.ts",
        "src/lib/kit/document.ts",
        "src/lib/icon-placeholder.tsx",
        "src/ui/reset.css"
      ],
      "design": {
        "axes": {
          "radius": {
            "attribute": "data-radius",
            "values": ["default", "none"]
          }
        },
        "presets": {
          "k": [{ "axis": "radius", "values": ["default", "none"], "bits": 2 }]
        }
      },
      "setup": {
        "config": {
          "module": "@/registry/lib/kit/config",
          "export": "kitConfig"
        },
        "stylesheets": ["@/registry/ui/reset.css"],
        "document": {
          "module": "@/registry/lib/kit/document",
          "export": "htmlStyles"
        }
      }
    },
    {
      "name": "button",
      "type": "component",
      "title": "Button",
      "description": "Displays a button.",
      "version": "1.0.0",
      "styles": ["src/ui/button.styles.ts"],
      "frameworks": { "react": { "base": { "files": ["src/ui/button.tsx"] } } }
    }
  ]
}
```

An item is written as the item document is, but each file names the source it is read from. A file's
type comes from the deepest folder in its path that names one, and its installed path from what
follows that folder; where the folders do not say, write the file as
`{ "source": …, "type": …, "path": …, "target": … }`.

| Folder                   | Type        | Installs under the consumer's alias                                       |
| ------------------------ | ----------- | ------------------------------------------------------------------------- |
| `ui/`                    | `ui`        | `@/components/ui` by default                                              |
| `lib/`                   | `lib`       | `@/lib`                                                                   |
| `hooks/`                 | `hook`      | `@/hooks`                                                                 |
| `components/`, `blocks/` | `component` | `@/components`                                                            |
| `pages/`                 | `page`      | `ui.aliases.page`, which has no default: `add` asks the project to set it |

A file in no such folder needs its `type`, and a `file` (installed at its own `target`, from the
project's root) always does.

What `ui build` does with each file:

- an import of another of the registry's files (`../lib/utils`) becomes `@/registry/lib/utils`, or
  `./name` beside it, and the item holding that file becomes a registry dependency (of the base, for
  a base's file);
- a package it imports becomes a dependency at the range the registry's `package.json` gives
  (`catalog:` and `catalog:<name>` resolved), unless the item names one; a base's own
  `bases/<framework>-<base>/package.json` comes first, so two bases can take two majors of one
  package. React, React DOM, Vue, Svelte, `solid-js`, `@solidjs/web`, `@angular/core`, `kirana-style`
  and `@kirana-style/*` are never dependencies: every project has them;
- `name`, `homepage`, `defaultBase` and `requires` go into the index as they are; `flattened` is
  copied as written, never read from a source;
- every item, then the index, is checked as `ui validate` checks it. On any problem nothing is
  written: an import of no file of the registry, an `@/registry/…` import no item provides, a
  package with no range, a missing file, an item named `index`, a default base or runtime for a base
  no item has.

A builder of your own uses the same functions:

```ts
import { readFileSync } from "node:fs"

import { buildRegistry, versionsFrom } from "@kirana-style/registry"
import type { SourceRegistry } from "@kirana-style/registry"

const source = JSON.parse(
  readFileSync("registry.json", "utf8")
) as SourceRegistry
const built = buildRegistry(source, ".", versionsFrom("."))
if (built.problems.length > 0) throw new Error(built.problems.join("\n"))
// built.items, built.index: write each as <name>.json, and index.json
```

## An item

| Field                  | Holds                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `name`                 | lower case words joined by `-`; never `index`                                                                      |
| `type`                 | `component`, `block`, `chart`, `lib`, `hook`, `font` or `design-system`                                            |
| `title`, `description` | what `ui search` and the MCP server's `search_items` match, with the name                                          |
| `version`              | a semantic version; a new one whenever a file changes                                                              |
| `kirana`               | the Kirana versions it was built and checked with, as a range (`ui view` shows it)                                 |
| `registryDependencies` | items it needs: `name` in the same registry, or `@namespace/name`                                                  |
| `dependencies`         | npm packages and ranges every base needs                                                                           |
| `axes`                 | the design axes its styles read                                                                                    |
| `styles`               | its style modules, one source for every framework                                                                  |
| `files`                | other files every framework installs                                                                               |
| `frameworks`           | `react`, `vue`, `svelte`, `solid`, `angular`: each base by name, `{ files, dependencies?, registryDependencies? }` |
| `font`                 | a font item's `{ family, import }`; `import` from a package in `dependencies`                                      |
| `design`, `setup`      | a design system's axes and presets, and its wiring                                                                 |
| `flattened`            | style modules built per value of one axis and per base, and files built per value of other axes                    |
| `meta`                 | anything else, unread                                                                                              |

Each file is `{ path, type, target?, content, hash }`: `target` only on a `file`, and `hash` is
`sha256-` and the base64 SHA-256 of the content. List every framework and base the item supports,
and only those.

## A design system item

| Entry               | What `ui init` does with it                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup.config`      | spreads the export into the project's `kirana.config.ts`                                                                                      |
| `setup.stylesheets` | imports each where the project imports Kirana's stylesheet, after it                                                                          |
| `setup.document`    | puts the export on `<html>` as `sx`, or sets its classes from the entry of a static page                                                      |
| `design.axes`       | each axis: the `data-*` attribute it writes on `<html>`, its values (the first the default), and `items` a value installs (a font per family) |
| `design.flatten`    | the axis your items carry flattened style modules for                                                                                         |
| `design.presets`    | layouts by a code's first letter: fields from bit 0, each `{ axis, values, bits }`                                                            |

`ui init` installs the first design system in the index (`--design <item>` picks another). A preset
code is the layout's letter and a base-62 number holding one index per field; with the layout above,
`k0` is `radius: default` and `k1` is `radius: none`. Append values and fields, never insert: a
published code keeps its indexes. A flag that names another framework or base than the code carries
stops `ui init --preset` before it writes anything.

A font item:

```json
{
  "name": "font-lora",
  "type": "font",
  "version": "1.0.0",
  "dependencies": { "@fontsource-variable/lora": "^5.2.0" },
  "font": {
    "family": "'Lora Variable', serif",
    "import": "@fontsource-variable/lora"
  }
}
```

Flattened builds, which the installer takes as they are for the project's design (prove each renders
as the module written does for that value):

```json
"flattened": {
  "axis": "style",
  "builds": { "vega": { "base": [{ "path": "button.styles.ts", "type": "ui", "content": "…", "hash": "sha256-…" }] } },
  "axes": { "baseColor": { "stone": [{ "path": "kit/base-colors.ts", "type": "lib", "content": "…", "hash": "sha256-…" }] } }
}
```

`axis` and `builds` come together; `axes` can stand alone. Each axis under `axes` builds its own
file, never one per combination of axes, and a build must replace a file the item installs.

## The index

```json
{
  "$schema": "https://kirana.style/schema/registry-index.json",
  "name": "Acme",
  "defaultBase": { "react": "base", "solid": "ark" },
  "requires": { "solid": { "uisdk": "solid2" } },
  "items": [
    {
      "name": "dialog",
      "type": "component",
      "version": "1.0.0",
      "frameworks": { "react": ["base", "aria"], "solid": ["ark", "uisdk"] }
    }
  ]
}
```

- `defaultBase`: the base a project gets when it sets no `ui.base`. `ui init` writes it into the
  project's `ui.base`, so changing it later affects only projects set up after.
- `requires`: the runtime a base needs, by a name you give it. A base the field leaves out needs the
  framework's default; a framework it does not name is never checked. Kirana tells Solid's apart:
  `solid2` where a project lists `@solidjs/web` or a `solid-js` from 2 on, else `solid1`.
- Each base either field names must be one an item lists, which `ui validate` checks.

## Templates

`templates/index.json`, beside the index, lists whole projects to start from:

```json
{
  "$schema": "https://kirana.style/schema/registry-templates.json",
  "templates": [
    { "name": "vite-react", "file": "vite-react.tgz" },
    {
      "name": "vite-solid2",
      "framework": "solid",
      "runtime": "solid2",
      "file": "vite-solid2.tgz"
    }
  ]
}
```

- Each archive is a gzipped tar with the project under one top folder, at a path relative to
  `templates/index.json`; `files` keyed by package manager (`npm`, `pnpm`, `yarn`, `bun`) replaces
  `file` for one archive each.
- A root `package.json` with `"packageManager": "{packageManager}"` gets the one running `init`; a
  workspace names its app in `"kirana-template": { "project": "apps/web" }`.
- `runtime` needs `framework`. `init` refuses a template on another framework or runtime than the
  base the project gets, naming your closest template that fits.
- `ui build` writes no template, and `ui validate` does not read this file.

## The lockfile, in the consumer

`kirana-style.lock.json`, committed:

```json
{
  "lockfileVersion": 1,
  "items": {
    "@acme/button": {
      "registry": "https://acme.dev/r/{name}.json",
      "version": "1.0.0",
      "framework": "react",
      "base": "base",
      "files": {
        "src/components/ui/button.tsx": {
          "source": "sha256-mL+u01BWzzeO7ZcLqQAs8s0HWDv9Y97c4Ntqd47gNEw=",
          "written": "sha256-mL+u01BWzzeO7ZcLqQAs8s0HWDv9Y97c4Ntqd47gNEw=",
          "code": "sha256-nLxpGdCB6Iu+lcdwpieHk+DVDv5x/ACAUBSWlGmuaNM="
        }
      }
    }
  }
}
```

`source` is the registry's content, `written` what was written, `code` the code with formatting set
aside: how later commands tell the registry's change from the project's, and a reformatted file from
a changed one.

## The commands

| Command                                | Reads                                | Writes                                                                                 | Exit                                        |
| -------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------- |
| `ui build [registry.json] --out <dir>` | the source and its files             | `<dir>/<name>.json` and `index.json` (`public/r` by default), nothing on a problem     | 1 on a problem                              |
| `ui validate <document…>`              | files, URLs or `@ns/name` references | nothing: each schema problem and hash mismatch                                         | 1 on a problem, 2 with no document          |
| `ui search [query] --registry @ns`     | every index                          | nothing (`--json`)                                                                     | 1 when a document cannot be read            |
| `ui view <item…>`                      | items                                | nothing (`--json` prints them as read)                                                 | 1 when a document cannot be read            |
| `ui init`                              | the index, the design system         | Kirana's setup, `ui` settings, aliases, the design system and its wiring, the lockfile | 1 when a file of the project's would change |
| `ui add <item…>`                       | items and what they need             | files at the aliases, packages, the lockfile; then `kirana-style check`                | 1 when a file of the project's would change |
| `ui outdated [item…]`                  | the lockfile and the registry        | nothing                                                                                | 1 when an item is behind                    |
| `ui diff [item…]`                      | the lockfile and the registry        | nothing: the lines between the project's file and what installing now would write      |                                             |
| `ui update [item…]`                    | the lockfile and the registry        | the registry's changes, keeping the project's; a file both changed stops it            | 1 when refused                              |
| `ui preset <code>`                     | the design system's layouts          | `ui.design`, `<html>`'s attributes, every installed item placed again                  | 2 for another framework's code              |
| `ui remove <item…>`                    | the lockfile                         | deletes files left as installed, unless another item needs it                          |                                             |
| `ui mcp`                               | the project's registries             | nothing: a Model Context Protocol server over stdio                                    |                                             |

`init`, `add`, `update`, `preset` and `remove` take `--dry-run`; all but `remove` take
`--overwrite` (replace files the project changed) and `--no-check`. `init` also takes `--registry
@ns=<template>`, `--design`, `--framework`, `--base`, `--preset`, `--all-designs`, `--template`,
`--workspace`, `--pointer` and `--rtl`. Each command's own help: `kirana-style ui <command> --help`.

## The consumer's settings

```ts
import { defineConfig } from "@kirana-style/core/config"

export default defineConfig({
  ui: {
    registries: {
      "@acme": "https://acme.dev/r/{name}.json",
      "@private": {
        url: "https://private.dev/r/{name}.json",
        headers: { Authorization: "Bearer ${TOKEN}" },
      },
      "@local": "../acme/public/r/{name}.json",
    },
  },
})
```

A template is a URL, a path from the configuration's folder, or a `file:` URL; a header reads an
environment variable as `${NAME}` and is never printed. `@kirana` is Kirana UI's registry, known
without being named.
