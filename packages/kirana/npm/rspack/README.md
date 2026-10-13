# @kirana-style/rspack

Kirana for Rspack and Rsbuild ([11-integrations](../../../../spec/11-integrations.md)).
Rspack runs `@kirana-style/webpack`'s plugin unchanged; this package re-exports it and adds the Rsbuild
plugin.

```ts
// rsbuild.config.ts
import { pluginKirana } from "@kirana-style/rspack"
import { defineConfig } from "@rsbuild/core"
import { pluginReact } from "@rsbuild/plugin-react"

export default defineConfig({ plugins: [pluginReact(), pluginKirana()] })
```

With Rspack directly: `plugins: [new KiranaPlugin()]`, and give CSS a module type
(`{ test: /\.css$/, type: "css" }`).
