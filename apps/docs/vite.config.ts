import { defineAppConfig } from "@workspace/vite-config"

// The site deploys as a Cloudflare Worker (wrangler.jsonc), its pages prerendered into the static
// files the Worker's assets serve.
export default defineAppConfig({ cloudflare: true, prerender: true })
