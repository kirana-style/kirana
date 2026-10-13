import kirana from "@kirana-style/esbuild"
import * as esbuild from "esbuild"

// `node build.mjs` builds into www/; `node build.mjs --serve` watches and serves it on $PORT, with
// esbuild's live reload. CSS imported from the entry is written as `main.css`, which the page links.
const options = {
  entryPoints: ["src/main.tsx"],
  bundle: true,
  outdir: "www",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [kirana()],
}

if (process.argv.includes("--serve")) {
  const context = await esbuild.context(options)
  await context.watch()
  await context.serve({
    servedir: "www",
    port: Number(process.env.PORT),
    host: "127.0.0.1",
  })
} else {
  await esbuild.build({ ...options, minify: true })
}
