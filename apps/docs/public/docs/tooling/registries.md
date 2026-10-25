# Publishing a registry
Source: https://kirana.style/docs/tooling/registries

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

| Entry         | What `init` does with it                                                   |
| ------------- | -------------------------------------------------------------------------- |
| `config`      | spreads it into the project's `kirana.config.ts`                           |
| `stylesheets` | imports each where the project imports Kirana's stylesheet                 |
| `document`    | puts it on `<html>` as `sx`, or sets the classes from a static app's entry |

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

## The index

The index is the item named `index`, valid against
[its schema](https://kirana.style/schema/registry-index.json): your registry's
name and each item's name, type, version and bases. `kirana-style ui search`
reads it.

## Checking

```bash
npx kirana-style ui validate public/r/button.json public/r/index.json
```

`validate` checks each document against its schema and each file's hash. Run it
in your registry's CI before you publish.
