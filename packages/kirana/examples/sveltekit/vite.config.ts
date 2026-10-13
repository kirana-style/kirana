import kirana from "@kirana-style/vite"
import { sveltekit } from "@sveltejs/kit/vite"
import { defineConfig } from "vite"

// Kirana before SvelteKit, so every component reaches Svelte already compiled.
export default defineConfig({ plugins: [kirana(), sveltekit()] })
