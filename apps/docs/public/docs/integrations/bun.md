# Bun
Source: https://site.kirana-style.workers.dev/docs/integrations/bun

# Bun

Bun writes CSS imported from an entry next to it (`main.css`), and the plugin
finishes it once every module has loaded. Tested by `examples/bun-react`.



## 1. Install

```bash
npm install @kirana-style/core
npm install -D @kirana-style/bun
```

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
