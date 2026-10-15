# webpack
Source: https://kirana.style/docs/integrations/webpack

# webpack

The plugin adds its loader in front of your own (`enforce: "pre"`), so it reads
`sx` before your JSX compiler (swc or Babel) compiles it away, and writes the
finished stylesheet once every module is built. Tested by
`examples/webpack-react`. Next.js has [its own guide](/docs/frameworks/nextjs),
and Gatsby, which runs webpack, [its own too](/docs/frameworks/gatsby).

> [!NOTE] Not on npm yet
> The packages are packed and install-tested on every change, but not published. Until they are, install them from tarballs as [Installation](/docs/start/installation#install-from-tarballs) shows; the rest of this page is the same either way.

## 1. Install

```bash
npm install @kirana-style/core
npm install -D @kirana-style/webpack
```

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
