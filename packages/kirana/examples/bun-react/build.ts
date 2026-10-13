import kirana from "@kirana-style/bun"

// Bun's bundler with the Kirana plugin. CSS imported from the entry is written as `main.css`, which
// the page links; the page itself is written here.
const result = await Bun.build({
  entrypoints: ["./src/main.tsx"],
  outdir: "./dist",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [kirana()],
})
if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
await Bun.write(
  "dist/index.html",
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Kirana on Bun + React</title>
    <link rel="stylesheet" href="/main.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.js"></script>
  </body>
</html>
`
)
