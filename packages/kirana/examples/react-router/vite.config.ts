import kirana from "@kirana-style/vite"
import { reactRouter } from "@react-router/dev/vite"
import { defineConfig } from "vite"

// Kirana before React Router, so routes and the root reach it as source.
export default defineConfig({
  plugins: [kirana(), reactRouter()],
})
