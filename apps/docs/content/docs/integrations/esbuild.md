---
title: esbuild
description: Kirana on esbuild - a plugin that compiles styles and finishes the bundled CSS, on disk, in memory, in watch mode and when serving.
section: integrations
order: 8
keywords: [esbuild, plugin, watch, serve, outputFiles]
---

# esbuild

esbuild writes CSS imported from an entry beside it (`main.css`), and the plugin
finishes it once every module has loaded — on disk, or in `outputFiles` with
`write: false`. Tested by `examples/esbuild-react`.

> [!NOTE] Not on npm yet
> The packages are packed and install-tested on every change, but not published.
> Until they are, install them from tarballs as
> [Installation](/docs/start/installation#install-from-tarballs) shows; the rest
> of this page is the same either way.

## 1. Install

<!-- ::install packages="@kirana-style/core" dev="@kirana-style/esbuild" -->

## 2. Add the plugin

```js file="build.mjs"
import kirana from "@kirana-style/esbuild"
import * as esbuild from "esbuild"

await esbuild.build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  outdir: "www",
  plugins: [kirana()],
})
```

With `context().watch()` and `serve()` the stylesheet follows every edit,
delivered by esbuild's live reload.

## 3. Import the stylesheet

```ts file="src/main.tsx"
import "@kirana-style/core/stylesheet.css"
```

## Next

- [Styles](/docs/styling/styles) and [conditions](/docs/styling/conditions).
- [Every bundler](/docs/integrations/bundlers).
