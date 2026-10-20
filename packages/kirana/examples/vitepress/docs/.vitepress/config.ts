import kirana, { cssLayer } from "@kirana-style/vite"
import { defineConfig } from "vitepress"

// VitePress builds with Vite: Kirana goes in its `vite.plugins`, and compiles the theme's Vue
// components and the components a page uses. The default theme imports its CSS from JavaScript,
// unlayered; `cssLayer` puts it in the `vitepress` layer that `kirana.config.ts` orders first.
export default defineConfig({
  title: "Kirana on VitePress",
  vite: {
    plugins: [
      kirana(),
      cssLayer("vitepress", "vitepress/dist/client/theme-default/"),
    ],
  },
})
