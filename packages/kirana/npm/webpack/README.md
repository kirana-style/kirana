# @kirana-style/webpack

The webpack 5 adapter for Kirana, which Rspack runs unchanged
([11-integrations](../../../../spec/11-integrations.md)).

```js
// webpack.config.js
import { KiranaPlugin } from "@kirana-style/webpack"

export default {
  experiments: { css: true }, // or css-loader with mini-css-extract-plugin
  plugins: [new KiranaPlugin()],
}
```

```js
// next.config.js — Next.js with webpack (`next build --webpack`)
import { withKirana } from "@kirana-style/webpack/next"

export default withKirana({})
```

- **Loader.** The plugin registers a `pre` loader for scripts, so `sx` is read before `swc-loader`,
  `babel-loader` or Next.js compile JSX away.
- **Stylesheet.** `@kirana-style/core/stylesheet.css` is ordinary CSS to webpack. The plugin writes the
  finished stylesheet into the emitted asset at `processAssets`' optimize stage: after every module,
  before the CSS minimizer and before `realContentHash` renames the file by its content.
- **Several compilers.** Every compiler of a project (Next.js's server, edge and client) shares one
  compiler session, so atoms from server components reach the client's stylesheet.

Options: `root` (default: the compiler's context), `config`, `reportInfo`. Under a dev server or a
watch build the plugin rewrites a live stylesheet file on every change, so webpack rebuilds the
stylesheet and sends it as a CSS hot update.
