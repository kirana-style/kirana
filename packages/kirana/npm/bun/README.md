# @kirana-style/bun

The Bun bundler adapter for Kirana ([11-integrations](../../../../spec/11-integrations.md)).

```ts
// build.ts
import kirana from "@kirana-style/bun"

await Bun.build({
  entrypoints: ["./src/main.tsx"],
  outdir: "./dist",
  plugins: [kirana()],
})
```

`onLoad` compiles modules that carry styles; the stylesheet entry loads as a placeholder that Bun
bundles as CSS, and `onEnd` writes the finished stylesheet into the emitted file (`main.css` for CSS
imported from `main.tsx`). A `naming` pattern that hashes CSS keeps the placeholder's hash, and
`write: false` keeps the placeholder.
