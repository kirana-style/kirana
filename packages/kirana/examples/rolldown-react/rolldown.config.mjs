import kirana from "@kirana-style/rolldown"
import { defineConfig } from "rolldown"

// Rolldown does not bundle CSS: the adapter writes the stylesheet as `kirana.css`, and the page
// links it. The page itself is emitted here, since Rolldown has no HTML entry either.
const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Kirana on Rolldown + React</title>
    <link rel="stylesheet" href="/kirana.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.js"></script>
  </body>
</html>
`

export default defineConfig({
  input: "src/main.tsx",
  output: { dir: "dist", format: "esm", minify: true },
  transform: { define: { "process.env.NODE_ENV": '"production"' } },
  plugins: [
    kirana(),
    {
      name: "page",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "index.html", source: page })
      },
    },
  ],
})
