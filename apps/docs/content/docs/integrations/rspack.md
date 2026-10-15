---
title: Rspack and Rsbuild
description: Kirana on Rspack and Rsbuild, through Rsbuild's pluginKirana or the webpack plugin, which Rspack runs unchanged.
section: bundlers
order: 5
keywords: [rspack, rsbuild, pluginKirana, rust bundler, webpack compatible]
---

# Rspack and Rsbuild

Rspack runs webpack's plugins unchanged, so Kirana's webpack plugin is its
plugin too; Rsbuild gets a one-line `pluginKirana`. Tested by
`examples/rsbuild-react` and `examples/rspack-react`.

<!-- ::npm-status -->

## 1. Install

<!-- ::install packages="@kirana-style/core" dev="@kirana-style/rspack" -->

## 2. Add the plugin

<!-- ::start:tabs -->

### Rsbuild

```ts file="rsbuild.config.ts"
import { pluginKirana } from "@kirana-style/rspack"
import { defineConfig } from "@rsbuild/core"
import { pluginReact } from "@rsbuild/plugin-react"

export default defineConfig({
  plugins: [pluginReact(), pluginKirana()],
})
```

### Rspack

```ts file="rspack.config.ts"
import { KiranaPlugin } from "@kirana-style/rspack"
import { defineConfig } from "@rspack/cli"

export default defineConfig({
  entry: { main: "./src/main.tsx" },
  // Rsbuild does this for you: CSS needs a module type.
  module: { rules: [{ test: /\.css$/, type: "css" }] },
  plugins: [new KiranaPlugin()],
})
```

<!-- ::end:tabs -->

## 3. Import the stylesheet

```ts file="src/main.tsx"
import "@kirana-style/core/stylesheet.css"
```

## Next

- [Styles](/docs/styling/styles) and [conditions](/docs/styling/conditions).
- [Every bundler](/docs/integrations/bundlers).
