import kirana from "@kirana-style/vite"
import vinext from "vinext"
import { defineConfig } from "vite"

// Kirana ahead of vinext, so `app/` reaches the React Server Components build already compiled:
// `sx` is a class name in the server render and in the browser alike.
export default defineConfig({
  plugins: [kirana(), vinext()],
})
