import { defineConfig } from "@kirana-style/core/config"

// In `docs/`, VitePress's source directory, which it makes Vite's root: Kirana reads its config
// there. The `vitepress` layer (`cssLayer` in .vitepress/config.ts) holds the default theme's CSS
// and sorts before Kirana's, so its reset loses to every style written with `css()`.
export default defineConfig({ layers: { before: ["vitepress"] } })
