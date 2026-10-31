# Rspack and Rsbuild
Source: https://site.kirana-style.workers.dev/docs/integrations/rspack

# Rspack and Rsbuild

Rspack runs webpack's plugins unchanged, so Kirana's webpack plugin is its
plugin too; Rsbuild gets a one-line `pluginKirana`. Tested by
`examples/rsbuild-react` and `examples/rspack-react`.



## 1. Install

```bash
npm install @kirana-style/core
npm install -D @kirana-style/rspack
```

## 2. Add the plugin



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



## 3. Import the stylesheet

```ts file="src/main.tsx"
import "@kirana-style/core/stylesheet.css"
```

## Next

- [Styles](/docs/styling/styles) and [conditions](/docs/styling/conditions).
- [Every bundler](/docs/integrations/bundlers).
