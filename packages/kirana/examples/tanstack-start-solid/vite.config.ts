import kirana from "@kirana-style/vite"
import { tanstackStart } from "@tanstack/solid-start/plugin/vite"
import { defineConfig } from "vite"
import viteSolid from "vite-plugin-solid"

// Kirana ahead of the framework plugins, so routes reach Solid's compiler with `sx` already a
// class. The build prerenders `/` into `dist/client`, which the example runner serves as static
// files.
export default defineConfig({
  plugins: [
    kirana(),
    tanstackStart({ prerender: { enabled: true, failOnError: true } }),
    viteSolid({ ssr: true }),
  ],
})
