# @kirana-style/registry

Kirana's component registry: the commands `kirana-style ui` runs, and the registry format's JSON
Schemas, types and checks.

```bash
npm install --save-dev @kirana-style/registry
npx kirana-style ui validate public/r/button.json
```

`kirana-style ui …` resolves this package from your project and runs it with the arguments after
`ui`, so the compiler every Kirana project installs carries no registry client.

## Commands

| Command                            | Does                                                                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `kirana-style ui validate <file…>` | Checks registry items, indexes and lockfiles against their schema, and every file's hash against its content. Exit 1 on a problem. |

Coming in later releases: `view`, `search`, `init`, `add`, `diff`, `update`, `outdated`,
`remove`, `preset`, `build` and `mcp`.

## The format

A registry is static JSON anyone can host: one document per item, at a URL template holding
`{name}`, and an index (the item named `index`). An item carries its style modules as written, one
source for every framework, and its markup per framework and base; installation flattens the
styles for the project's design. Every file carries a SHA-256 integrity hash. A project records
what it installed in `kirana-style.lock.json`.

The schemas are exported, for editors and other tools:

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
