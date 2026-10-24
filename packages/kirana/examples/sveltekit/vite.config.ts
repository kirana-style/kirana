import kirana from "@kirana-style/vite"
import adapter from "@sveltejs/adapter-static"
import { sveltekit } from "@sveltejs/kit/vite"
import { defineConfig } from "vite"

// Kirana before SvelteKit, so every component reaches Svelte already compiled. SvelteKit 3 takes
// its configuration here: `svelte.config.js` is no longer read.
export default defineConfig({
  plugins: [kirana(), sveltekit({ adapter: adapter() })],
})
