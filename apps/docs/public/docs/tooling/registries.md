# Publishing a registry
Source: https://site.kirana-style.workers.dev/docs/tooling/registries

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

When your items have several bases for a framework, the index can name the one a
project gets when it sets no `ui.base`, per framework:

```json
{
  "name": "Acme",
  "defaultBase": { "react": "base", "vue": "ark" },
  "items": [
    {
      "name": "button",
      "type": "component",
      "version": "1.0.0",
      "frameworks": { "react": ["base", "aria"], "vue": ["ark"] }
    }
  ]
}
```

- `kirana-style ui add` installs that base from an item that has several. An
  item with one base for the framework installs it, and one whose bases do not
  include the default still asks for a base.
- A project's own `ui.base` always wins.
- `kirana-style ui init` writes the default into the new project's `ui.base`, so
  the project keeps its base when you change the default later. Changing it is
  an edit to the index, and only projects set up after it get the new one.
- Each default must be a base an item lists for that framework, which
  `kirana-style ui validate` checks.

### Bases on another runtime

Some bases run on one major of their framework only: a Solid base on ui-sdk
needs Solid 2, where Ark UI's is on Solid 1. The index says so in `requires`,
per framework, then per base, by a name you give the runtime:

```json
{
  "defaultBase": { "solid": "ark" },
  "requires": { "solid": { "uisdk": "solid2" } },
  "items": [
    {
      "name": "dialog",
      "type": "component",
      "version": "1.0.0",
      "frameworks": { "solid": ["ark", "uisdk"] }
    }
  ]
}
```

- A base of that framework the field leaves out needs the framework's default
  runtime: here `ark` is on Solid 1. A framework the field does not name is
  never checked, so an index without it installs as before.
- `kirana-style ui init --template` refuses a template on another runtime than
  the base the project gets, before it writes anything, and names one of your
  templates that fits.
- `kirana-style ui add` and `kirana-style ui init` refuse a project on another
  runtime, and name the bases that fit it.
- Kirana tells Solid's two runtimes apart in a project: `solid2` where it lists
  `@solidjs/web`, or a `solid-js` from 2 on, else `solid1`, Solid's default. A
  project on other packages, or whose Solid range has no number, is not checked.
- Each base must be one an item lists for that framework, which
  `kirana-style ui validate` checks.

## Templates

A registry can offer whole projects to start from: an app in the layout you
support, its tooling, a workspace around it. List them in `templates/index.json`,
beside the index (the document your URL template gives for `templates/index`),
valid against
[its schema](https://kirana.style/schema/registry-templates.json):

```json
{
  "$schema": "https://kirana.style/schema/registry-templates.json",
  "templates": [
    { "name": "vite-react", "file": "vite-react.tgz" },
    {
      "name": "vite-react--turbo",
      "title": "Vite in a Turborepo",
      "file": "vite-react--turbo.tgz"
    }
  ]
}
```

An entry can name the framework its app is on, and the runtime when it is not
the framework's default, as the index's `requires` names it:

```json
{
  "$schema": "https://kirana.style/schema/registry-templates.json",
  "templates": [
    { "name": "vite-solid", "framework": "solid", "file": "vite-solid.tgz" },
    {
      "name": "vite-solid2",
      "framework": "solid",
      "runtime": "solid2",
      "file": "vite-solid2.tgz"
    }
  ]
}
```

A template's runtime is its entry's, else what the packages its app lists say.
When a base needs another runtime, the refusal names your template of the
same framework on that runtime whose name is closest: `vite-solid2--turbo` for
`vite-solid--turbo`. A `runtime` needs its `framework`.

Each archive:

- is a gzipped tar with the project's files under one top folder, as `giget`
  and `npm pack` read one, at a path relative to `templates/index.json`;
- can be one per package manager: `files` in place of `file`, keyed by the
  package manager's name, and `init` takes the one it runs under;
- is enough alone when its root `package.json` asks for the package manager with
  `"packageManager": "{packageManager}"`, which `init` fills with the one
  running it, at its version (a Turborepo needs the field).

In a workspace, the root `package.json` names the app `init` sets up:

```json
{
  "name": "my-app",
  "private": true,
  "packageManager": "{packageManager}",
  "workspaces": ["apps/*", "packages/*"],
  "kirana-template": { "project": "apps/web" }
}
```

```bash
npx @kirana-style/registry init --template @acme/vite-react--turbo my-app --registry @acme=https://acme.dev/r/{name}.json --preset k2bS6
```

From there `init`:

1. unpacks the archive into `my-app` and names the root package after the folder;
2. installs the workspace with the package manager its root names, else the one
   running `init`;
3. sets `apps/web` up as it sets up any project, with the design system from your
   registry, a preset, and the pointer and right-to-left flags.

An archive's URL works the same without an index:
`--template https://acme.dev/r/templates/vite-react.tgz`. `kirana-style ui build`
writes no template: pack each with your own build, beside what `build` writes.

## Building it

Write your registry's source as items whose files name where they are read
from, in a `registry.json`, and `kirana-style ui build` writes the documents:

```json
{
  "name": "Acme",
  "homepage": "https://acme.dev",
  "defaultBase": { "react": "base" },
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
  gives it (a workspace's `catalog:` and named `catalog:<name>` included),
  unless the item names one. The framework's own packages and Kirana's are left
  out: every project has them.

`name`, `homepage`, `defaultBase` and `requires` go into the index as they are.

Every item, then the index, is checked as `validate` checks it, and nothing is
written when a problem is found: an import of no file of the registry, a package
with no range, a file that is not there, a default base or a runtime for a base
no item has.

### Two bases on two majors

Two bases of one framework can need two majors of one package: a Solid base on
Solid 1 takes `solid-sonner` 0.3 where a base on Solid 2 takes 1.0. Give such a
base its own `package.json` at `bases/<framework>-<base>/package.json`, beside
`registry.json`. A package it names takes that range in that base's files; a
package it does not name takes your registry's.

```json
{
  "dependencies": {
    "solid-js": "catalog:solid2",
    "solid-sonner": "^1.0.0"
  }
}
```

A package an item's shared files import goes into the item's `dependencies`
when every base takes the same range, and into each base's `dependencies` when
the ranges differ. `kirana-style ui add` installs the item's packages and those
of the project's base, the base's range first, so a Solid 2 project gets
`solid-sonner` 1.0 and a Solid 1 project 0.3. Items built before install as they
did.

A builder of your own reads the same ranges through `@kirana-style/registry`:
`versionsFrom(root)` returns a function that takes a package's name and, for a
base's files, the framework and base,
`versions("solid-sonner", { framework: "solid", base: "uisdk" })`.
`buildRegistry(source, root, versions)` asks yours the same way, and one that
reads the name alone still works.

## Checking

```bash
npx kirana-style ui validate public/r/button.json public/r/index.json
```

`validate` checks each document against its schema and each file's hash. Run it
in your registry's CI before you publish, on what `build` wrote or on documents
you write yourself.
