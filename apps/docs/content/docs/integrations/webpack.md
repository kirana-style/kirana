---
title: webpack
description: Kirana on webpack 5, with a pre loader that reads sx before your JSX compiler and a plugin that writes the stylesheet before minification.
section: bundlers
order: 4
keywords:
  [webpack, loader, plugin, css, realContentHash, mini-css-extract-plugin]
---

# webpack

The plugin adds its loader in front of your own (`enforce: "pre"`), so it reads
`sx` before your JSX compiler (swc or Babel) compiles it away, and writes the
finished stylesheet once every module is built. Tested by
`examples/webpack-react`. Next.js has [its own guide](/docs/frameworks/nextjs),
and Gatsby, which runs webpack, [its own too](/docs/frameworks/gatsby).

<!-- ::npm-status -->

## 1. Install

<!-- ::install packages="@kirana-style/core" dev="@kirana-style/webpack" -->

## 2. Add the plugin

```js file="webpack.config.js"
import { KiranaPlugin } from "@kirana-style/webpack"

export default {
  // Webpack's native CSS, or css-loader with mini-css-extract-plugin.
  experiments: { css: true },
  plugins: [new KiranaPlugin()],
}
```

## 3. Import the stylesheet

```ts file="src/main.tsx"
import "@kirana-style/core/stylesheet.css"
```

The stylesheet entry is ordinary CSS to webpack: it names, links and minifies it
like any other. The plugin fills it in before the minifier runs and before
`realContentHash` names the file after its real content, which is on by default
in production; turn it off and the file name stops tracking the styles.

## Next

- [Styles](/docs/styling/styles) and [conditions](/docs/styling/conditions).
- [Every bundler](/docs/integrations/bundlers).
