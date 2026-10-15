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

TypeScript and JavaScript files are imported natively; the default export is the
configuration.

## What overrides what

Options passed to the adapter override the file, key by key:

```ts file="vite.config.ts"
kirana({ config: { names: { prefix: "app" } } })
```

The project root comes from the adapter (Vite's `root`, or the CLI's working
directory) and cannot be set in the file.

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
see [`conditions.exclusive`](/docs/config/reference).
