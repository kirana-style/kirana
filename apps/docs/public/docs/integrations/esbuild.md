# esbuild
Source: https://kirana.style/docs/integrations/esbuild

# esbuild

esbuild writes CSS imported from an entry beside it (`main.css`), and the plugin
finishes it once every module has loaded, on disk or in `outputFiles` with
`write: false`. Tested by `examples/esbuild-react`.



## 1. Install

```bash
npm install @kirana-style/core
npm install -D @kirana-style/esbuild
```

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
