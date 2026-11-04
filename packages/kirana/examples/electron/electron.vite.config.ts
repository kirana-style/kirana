import kirana from "@kirana-style/vite"
import { defineConfig } from "electron-vite"

// Kirana compiles the renderer, the one process that renders a page; the main process has no styles.
export default defineConfig({
  main: {},
  renderer: { plugins: [kirana()] },
})
