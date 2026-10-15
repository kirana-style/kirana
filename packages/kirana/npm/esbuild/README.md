# @kirana-style/esbuild

The esbuild adapter for Kirana ([11-integrations](../../../../spec/11-integrations.md)).

```js
import kirana from "@kirana-style/esbuild"
import * as esbuild from "esbuild"

await esbuild.build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  outdir: "www",
  plugins: [kirana()],
})
```

`onLoad` compiles modules that carry styles; the stylesheet entry loads as a placeholder esbuild
bundles as CSS, and `onEnd` writes the finished stylesheet into it, on disk or in `outputFiles`
with `write: false`. Under `context().watch()` and `serve()` the entry reloads from a file the plugin
keeps current, so the served stylesheet follows every edit.
