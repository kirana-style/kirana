import { cloudflare } from "@cloudflare/vite-plugin"
import kirana from "@kirana-style/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Cloudflare's plugin first, so it owns the server environment before TanStack Start configures
// it: `vite dev` then renders each request inside workerd, as production does. Kirana ahead of the
// framework plugins, so routes reach them compiled. The build prerenders `/` into `dist/client`,
// which the example runner serves as static files.
export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    kirana(),
    tanstackStart({ prerender: { enabled: true, failOnError: true } }),
    viteReact(),
  ],
})
