# @kirana-style/registry

Kirana's component registry: the commands `kirana-style ui` runs, and the registry format's JSON
Schemas, types and checks.

```bash
npm install --save-dev @kirana-style/registry
npx kirana-style ui search button
npx kirana-style ui view @acme/button
npx kirana-style ui validate public/r/button.json
```

`kirana-style ui …` resolves this package from your project and runs it with the arguments after
`ui`, so the compiler every Kirana project installs carries no registry client.

## Commands

| Command                                | Does                                                                                                                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kirana-style ui view <item…>`         | Shows an item: its version, type, Kirana range, dependencies, style modules, each framework's bases with their files, and its shared files; never a file's content. `--json` prints the items as read.        |
| `kirana-style ui search [query]`       | Lists the items of every registry's index whose name, title or description holds the query. `--registry <namespace>` (repeatable) searches only those; `--json` prints the results.                           |
| `kirana-style ui validate <document…>` | Checks registry items, indexes and lockfiles against their schema, and every file's hash against its content. A document is a file, a URL, or an item of your registries (`@acme/card`). Exit 1 on a problem. |

A document that cannot be read is named with what failed, and the command exits 1.

Coming in later releases: `init`, `add`, `diff`, `update`, `outdated`, `remove`, `preset`,
`build` and `mcp`.

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
