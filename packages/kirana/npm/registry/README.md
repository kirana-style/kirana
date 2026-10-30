# @kirana-style/registry

Kirana's component registry: the commands `kirana-style ui` runs, and the registry format's JSON
Schemas, types and checks.

```bash
npx @kirana-style/registry init --template vite-react my-app   # a new project, from nothing

npm install --save-dev @kirana-style/registry                  # or in a project you have
npx kirana-style ui init
npx kirana-style ui add button
npx kirana-style ui search button
npx kirana-style ui view @acme/button
npx kirana-style ui validate public/r/button.json
```

`kirana-style ui …` resolves this package from your project and runs it with the arguments after
`ui`, so the compiler every Kirana project installs carries no registry client. Before a project
exists, the package runs on its own (`npx @kirana-style/registry <command>`, its `kirana-style-ui`
bin), and `init` adds it to the project it sets up.

## Commands

| Command                                | Does                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kirana-style ui init`                 | Sets a project up for a registry: Kirana where it is missing, the `ui` settings, the aliases when the project maps none, and the registry's design system installed and wired in (its configuration, stylesheets and `<html>` styles). `--framework`, `--base`, `--registry @acme=<template>`, `--design <item>`, `--template <example> [directory]` (a new project from one of Kirana's examples), `--preset <code>`, `--dry-run`, `--overwrite`, `--no-check`. |
| `kirana-style ui add <item…>`          | Installs items and every item they need: files under the project's alias for their type (through `tsconfig.json`'s `paths`), imports rewritten to those aliases, packages added with the project's package manager, each item in `kirana-style.lock.json`. `--dry-run`, `--overwrite`. It then checks what it wrote with `kirana-style check` (`--no-check` skips that).                                                                                         |
| `kirana-style ui outdated [item…]`     | Lists the installed items whose registry has a new version or changed files. Exit 1 when one does.                                                                                                                                                                                                                                                                                                                                                               |
| `kirana-style ui diff [item…]`         | Shows each installed file the registry or the project changed since it was installed, as lines against what installing it now would write.                                                                                                                                                                                                                                                                                                                       |
| `kirana-style ui update [item…]`       | Writes what the registry changed since an item was installed and keeps what you changed; a file both changed stops it until you look (`ui diff`) or pass `--overwrite`. Items an update newly needs are installed with it. `--dry-run`.                                                                                                                                                                                                                          |
| `kirana-style ui remove <item…>`       | Deletes the files of an item you left as installed and drops it from the lockfile, unless another installed item needs it. `--dry-run`.                                                                                                                                                                                                                                                                                                                          |
| `kirana-style ui preset <code>`        | Changes the project's design: the code read with its design system's layouts, `ui.design` and `<html>`'s attributes set, every installed item placed again with its registry's flattening for the new design. `--overwrite`, `--dry-run`.                                                                                                                                                                                                                        |
| `kirana-style ui view <item…>`         | Shows an item: its version, type, Kirana range, dependencies, style modules, each framework's bases with their files, and its shared files; never a file's content. `--json` prints the items as read.                                                                                                                                                                                                                                                           |
| `kirana-style ui search [query]`       | Lists the items of every registry's index whose name, title or description holds the query. `--registry <namespace>` (repeatable) searches only those; `--json` prints the results.                                                                                                                                                                                                                                                                              |
| `kirana-style ui validate <document…>` | Checks registry items, indexes and lockfiles against their schema, and every file's hash against its content. A document is a file, a URL, or an item of your registries (`@acme/card`). Exit 1 on a problem.                                                                                                                                                                                                                                                    |

A document that cannot be read is named with what failed, and the command exits 1.

Coming in later releases: `build` and `mcp`.

## Registries

Name them in `kirana.config.*`, under `ui`:

```ts
export default defineConfig({
  ui: {
    registries: {
      "@acme": "https://acme.dev/r/{name}.json",
      "@private": {
        url: "https://private.dev/r/{name}.json",
        headers: { Authorization: "Bearer ${PRIVATE_TOKEN}" },
      },
    },
  },
})
```

`@kirana`, Kirana UI's registry, is known without being named. Documents are fetched over
`https:`, or `http:` from your own machine, or read from disk for a path, afresh each time.

## The format

A registry is static JSON anyone can host: one document per item, at a URL template holding
`{name}`, and an index (the item named `index`). An item carries its style modules as written, one
source for every framework, and its markup per framework and base, with the packages and items
only that base needs; installation flattens the
styles for the project's design. Every file carries a SHA-256 integrity hash. A project records
what it installed in `kirana-style.lock.json`.

The schemas are served at their ids, for editors and other tools
(`https://kirana.style/schema/registry-item.json`, `registry-index.json`, `lockfile.json`,
`settings.json`), and exported:

```ts
import {
  INDEX_SCHEMA,
  ITEM_SCHEMA,
  LOCKFILE_SCHEMA,
} from "@kirana-style/registry/schema"
```

and the checks the commands use:

```ts
import { check, hashOf } from "@kirana-style/registry"

const { kind, problems } = check(JSON.parse(text))
```

The specification is
[12-tooling-and-dx](https://github.com/kirana-style/kirana/blob/main/spec/12-tooling-and-dx.md#component-registry).

## License

MIT
