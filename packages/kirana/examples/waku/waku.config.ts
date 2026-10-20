import kirana from "@kirana-style/vite"
import { defineConfig } from "waku/config"

// Waku builds with Vite: its plugins go under `vite`. Kirana compiles server and client components
// alike, so `sx` is a class name in the server render and in the browser.
export default defineConfig({
  vite: {
    plugins: [kirana()],
  },
})
