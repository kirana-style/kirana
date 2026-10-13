import { defineAppConfig } from "@workspace/vite-config"

// The site deploys as a Cloudflare Worker (wrangler.jsonc).
export default defineAppConfig({ cloudflare: true })
