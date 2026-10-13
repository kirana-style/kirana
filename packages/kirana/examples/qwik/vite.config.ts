import kirana from "@kirana-style/vite"
import { qwikVite } from "@qwik.dev/core/optimizer"
import { qwikRouter } from "@qwik.dev/router/vite"
import { defineConfig } from "vite"

// Kirana first, so Qwik's optimizer splits components that are already compiled. One Kirana
// session serves the server render and the client, so both see the same atoms.
export default defineConfig({
  plugins: [kirana(), qwikRouter(), qwikVite()],
})
