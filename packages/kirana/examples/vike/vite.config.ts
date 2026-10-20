import kirana from "@kirana-style/vite"
import react from "@vitejs/plugin-react"
import vike from "vike/plugin"
import { defineConfig } from "vite"

// Kirana first, so pages reach React's and Vike's plugins with `sx` already a class name.
export default defineConfig({
  plugins: [kirana(), react(), vike()],
})
