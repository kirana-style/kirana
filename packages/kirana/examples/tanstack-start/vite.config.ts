import kirana from "@kirana-style/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Kirana ahead of the framework plugins, so routes reach them compiled. The build prerenders `/`
// into `dist/client`, which the example runner serves as static files.
export default defineConfig({
  plugins: [
    kirana(),
    tanstackStart({ prerender: { enabled: true, failOnError: true } }),
    viteReact(),
  ],
})
