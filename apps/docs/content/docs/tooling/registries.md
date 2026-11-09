---
title: Publishing a registry
description: The component registry format kirana-style ui reads, and how to host, check and wire a design system for it.
section: tooling
order: 7
keywords: [registry, publish, format, schema, items, design system, hash]
---

# Publishing a registry

A registry is static JSON anyone can host: one document per item at a URL that
holds the item's name, and an index. A project names it in `ui.registries`, and
`kirana-style ui` reads it as it reads Kirana UI's.

## An item

An item is one document, valid against
[its schema](https://kirana.style/schema/registry-item.json). Its style modules
are written once, for every framework, and its markup is given per framework and
base:

```json
{
  "$schema": "https://kirana.style/schema/registry-item.json",
  "name": "button",
  "type": "component",
  "version": "1.0.0",
  "registryDependencies": ["kit"],
  "styles": [
    {
      "path": "button.styles.ts",
      "type": "ui",
      "content": "…",
      "hash": "sha256-…"
    }
  ],
  "frameworks": {
    "react": {
      "base": {
        "files": [
          {
            "path": "button.tsx",
            "type": "ui",
            "content": "…",
            "hash": "sha256-…"
          }
        ],
        "dependencies": { "@base-ui/react": "^1.9.0" }
      }
    }
  }
}
```

List every framework and base the item supports, and only those. A base names
the packages and items only it needs beside its files.

## Files and imports

A file's `type` says where it installs:

| Type                                     | Installs                                     |
| ---------------------------------------- | -------------------------------------------- |
| `ui`, `component`, `lib`, `hook`, `page` | under the project's alias for that type      |
| `file`                                   | at its own `target`, from the project's root |

Every file carries `hash`, the base64 SHA-256 of its content after `sha256-`.

A file names another installed file by the type and path the item lists it with:

```ts
import { axes } from "@/registry/lib/kit/axes"
```

Installation rewrites that to the project's alias, such as `@/lib/kit/axes`. A
component that draws an icon names it once for every library, as shadcn/ui's do:

```tsx
<IconPlaceholder
  lucide="ChevronDownIcon"
  tabler="IconChevronDown"
  hugeicons="ArrowDown01Icon"
/>
```

## A design system

An item of type `design-system` carries its wiring in `setup`, which
`kirana-style ui init` follows:

```json
"setup": {
  "config": { "module": "@/registry/lib/kit/config", "export": "kitConfig" },
  "stylesheets": ["@/registry/ui/reset.css"],
  "document": { "module": "@/registry/lib/kit/document", "export": "htmlStyles" }
}
```

What each entry is for:

| Entry         | What `init` does with it                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `config`      | spreads it into the project's `kirana.config.ts`                                                    |
| `stylesheets` | imports each where the project imports Kirana's stylesheet, or lists each beside it in Nuxt's `css` |
| `document`    | puts it on `<html>` as `sx`, or sets the classes from a static app's entry                          |

## Its design, and flattened builds

A design system also says, in `design`, what `kirana-style ui preset` reads: each
axis as the attribute it sets on `<html>`, with its values (the first the
default); the axis your registry flattens for; and the layouts of its preset
codes.

```json
"design": {
  "axes": {
    "style": { "attribute": "data-style", "values": ["nova", "vega"] },
    "radius": { "attribute": "data-radius", "values": ["default", "none"] }
  },
  "flatten": "style",
  "presets": {
    "k": [
      { "axis": "style", "values": ["nova", "vega"], "bits": 5 },
      { "axis": "radius", "values": ["default", "none"], "bits": 3 }
    ]
  }
}
```

A code is the layout's letter and a base-62 number holding one index per field,
from bit 0. Fields may also set `framework`, `base` and `iconLibrary`.

An axis can name the item each of its values installs, in `items`. A font axis
names a font item per family, and a value with nothing to install, such as a
heading that inherits the body's font, names none:

```json
"fontHeading": {
  "attribute": "data-font-heading",
  "values": ["inherit", "lora"],
  "items": { "lora": "font-lora" }
}
```

`ui init --preset` installs the items its values name, and `ui preset` installs
the ones a new code names. An item no value names any more stays installed, and
`preset` says it can go with `ui remove`.

## Fonts

An item of type `font` names its family, the stack your tokens write, and the
stylesheet that loads it, from a package it lists in `dependencies`:

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

`ui add font-lora` installs the package and imports the stylesheet once, where
the project imports Kirana's stylesheet, after it. A project that loads Kirana's
stylesheet through PostCSS (Next.js's `@kirana;`) is told to add the import by
hand.

The checks refuse a font item without its `font`, a `font` on any other item, and
an `import` from a package the item's dependencies do not list.

An item can carry its style modules flattened for each value of that axis and
each base, beside the modules as written. Installation takes the build for the
project's design, and the modules as written for a design you did not build:

```json
"flattened": {
  "axis": "style",
  "builds": {
    "vega": { "base": [{ "path": "button.styles.ts", "type": "ui", "content": "…", "hash": "sha256-…" }] }
  }
}
```

Build them with the checks that prove a flattened module renders what the module
as written does for that design: the installer takes them as they are.

The other axes are flattened per file. A file that reads one axis alone, such as a
palette of base colours, can carry a build for each value of that axis under
`axes`, and installation replaces the file with the build for the project's value.
`axes` sits beside `axis` and `builds`, which always come together, or alone in an
item with no style modules, such as a design system's colours:

```json
"flattened": {
  "axes": {
    "baseColor": {
      "stone": [{ "path": "kit/base-colors.ts", "type": "lib", "content": "…", "hash": "sha256-…" }]
    }
  }
}
```

Each axis has its own builds, never one per combination of axes, so give each axis
its own file. A file that reads two axes stays as written. A value you did not
build keeps the file as written, and the checks refuse a build that replaces no
file of the item.

## The index

The index is the item named `index`, valid against
[its schema](https://kirana.style/schema/registry-index.json): your registry's
name and each item's name, type, version and bases. `kirana-style ui search`
reads it.

## Building it

Write your registry's source as items whose files name where they are read
from, in a `registry.json`, and `kirana-style ui build` writes the documents:

```json
{
  "name": "Acme",
  "homepage": "https://acme.dev",
  "items": [
    {
      "name": "button",
      "type": "component",
      "version": "1.0.0",
      "styles": ["src/ui/button.styles.ts"],
      "frameworks": {
        "react": { "base": { "files": ["src/ui/button.tsx"] } }
      }
    },
    {
      "name": "utils",
      "type": "lib",
      "version": "1.0.0",
      "files": ["src/lib/utils.ts"]
    }
  ]
}
```

```bash
npx kirana-style ui build                       # registry.json into public/r
npx kirana-style ui build registry.json --out dist/r
```

A file's type comes from the deepest folder in its source's path that names one,
and its path in the project from what follows that folder:

| Folder                   | Type        |
| ------------------------ | ----------- |
| `ui/`                    | `ui`        |
| `lib/`                   | `lib`       |
| `hooks/`                 | `hook`      |
| `components/`, `blocks/` | `component` |
| `pages/`                 | `page`      |

Where the folders do not say, give the file as an object:
`{ "source": …, "type": …, "path": …, "target": … }`.

Each file is read and hashed, and its imports are written for an installed
project:

- an import of another of the registry's files (`../lib/utils`) becomes
  `@/registry/lib/utils`, or `./name` beside it, and the item holding that file
  becomes a registry dependency;
- a package it imports becomes a dependency, at the range your `package.json`
  gives it (a workspace's `catalog:` included), unless the item names one. The
  framework's own packages and Kirana's are left out: every project has them.

Every item is checked as `validate` checks it, and nothing is written when a
problem is found: an import of no file of the registry, a package with no range,
a file that is not there.

## Checking

```bash
npx kirana-style ui validate public/r/button.json public/r/index.json
```

`validate` checks each document against its schema and each file's hash. Run it
in your registry's CI before you publish, on what `build` wrote or on documents
you write yourself.
