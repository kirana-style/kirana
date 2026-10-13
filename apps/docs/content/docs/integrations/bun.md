---
title: Bun
description: Kirana with Bun's bundler and dev server - one plugin for Bun.build and bunfig.toml.
section: integrations
order: 7
keywords: [bun, bun build, bunfig, dev server, plugin]
---

# Bun

Bun writes CSS imported from an entry next to it (`main.css`), and the plugin
finishes it once every module has loaded. Tested by `examples/bun-react`.

> [!NOTE] Not on npm yet
> The packages are packed and install-tested on every change, but not published.
> Until they are, install them from tarballs as
> [Installation](/docs/start/installation#install-from-tarballs) shows; the rest
> of this page is the same either way.

## 1. Install

<!-- ::install packages="@kirana-style/core" dev="@kirana-style/bun" -->

## 2. Add the plugin

```ts file="build.ts"
import kirana from "@kirana-style/bun"

await Bun.build({
  entrypoints: ["./src/main.tsx"],
  outdir: "./dist",
  plugins: [kirana()],
})
```

For Bun's dev server (`bun ./index.html`), register it in `bunfig.toml`; there
the stylesheet follows every edit:

```ts file="kirana.ts"
import kirana from "@kirana-style/bun"

export default kirana()
```

```toml file="bunfig.toml"
[serve.static]
plugins = ["./kirana.ts"]
```

## 3. Import the stylesheet

```ts file="src/main.tsx"
import "@kirana-style/core/stylesheet.css"
```

## Limits

A `naming` pattern that hashes CSS assets keeps the placeholder's hash, and a
build with `write: false` keeps the placeholder, because there is no file to
finish.

## Next

- [Styles](/docs/styling/styles) and [conditions](/docs/styling/conditions).
- [Every bundler](/docs/integrations/bundlers).
