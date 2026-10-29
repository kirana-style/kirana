---
title: The configuration file
description: Where kirana.config.ts lives, how it is found, and what overrides what.
section: config
order: 1
keywords: [kirana.config, defineConfig, configuration, setup]
---

# The configuration file

Configuration is optional. Every key has a default, and a project with no
`kirana.config.ts` compiles.

```ts file="kirana.config.ts"
import { defineConfig } from "@kirana-style/core/config"

export default defineConfig({
  layers: { before: ["reset", "base"] },
  targets: { chrome: 123, safari: "17.5" },
})
```

`defineConfig` is an identity function: it exists for the types.

## How it is found

The compiler looks in the project root, in this order, and takes the first match:

1. `kirana.config.ts`
2. `kirana.config.mts`
3. `kirana.config.js`
4. `kirana.config.mjs`
5. `kirana.config.json`

A build whose root is a folder of your package with no configuration of its own,
as Vite's `root: "viewer"` is, reads the one beside `package.json`, where
`kirana-style ui init` writes it. That folder is then the project root.

TypeScript and JavaScript files are imported natively; the default export is the
configuration.

A TypeScript configuration written as an ES module loads as one even when your
`package.json` says `"type": "commonjs"`, as `npm init` writes, and so do the
TypeScript files it imports.

Node.js loads the file as it is, without a bundler, and so its imports: a relative
import in the configuration, or in a module it imports, needs its extension
(`./states.ts`, not `./states`). When the file fails to load, the command says which
file and which module it could not find, and exits with 2.

### In a workspace

The CLI's `check`, `trace` and `export` read, for each path you give them, the
nearest configuration file above it, as TypeScript finds its own configuration. Run from
the workspace root, they check each app with the app's own configuration. A path
with no configuration above it reads the working directory's, and a `--config`
option makes every path read one file. See
[the CLI](/docs/tooling/cli#which-configuration).

## What overrides what

Options passed to the adapter override the file, key by key:

```ts file="vite.config.ts"
kirana({ config: { names: { prefix: "app" } } })
```

The project root comes from the adapter (Vite's `root`, or the package root above
it that holds the configuration; for the CLI, the directory of the configuration a
path reads, or the working directory) and cannot be set in the file.

## Unknown keys are errors

The validator rejects keys it does not know (`invalid-config`), rather than
ignoring them. A typo fails the build instead of silently doing nothing, and a
key from a future version fails loudly rather than pretending to work.

## Sharing configuration

A configuration is a plain object, so a shared one is a plain export:

```ts file="packages/ui/src/kirana.ts"
export const uiConfig = {
  conditions: {
    exclusive: [["[data-starting-style]", "[data-ending-style]"]],
  },
} satisfies KiranaConfig
```

```ts file="apps/web/kirana.config.ts"
export default defineConfig({ ...uiConfig, layers: { before: ["reset"] } })
```

That is how a component library tells every app what its attributes guarantee;
see [`conditions.exclusive`](/docs/reference/config).
