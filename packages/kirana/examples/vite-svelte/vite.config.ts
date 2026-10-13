import kirana from "@kirana-style/vite"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import { defineConfig } from "vite"

// Kirana before Svelte, so Svelte compiles the rewritten component.
export default defineConfig({ plugins: [kirana(), svelte()] })
