import type { UserConfigFnObject } from "vite"

/**
 * The Vite config every app in this repo shares. `cloudflare: true` builds the app as a Cloudflare
 * Worker (its `wrangler.jsonc`) and runs the server half in workerd during `vite dev` too.
 * `prerender: true` renders every page reachable from `/` into the static files at build time.
 */
export function defineAppConfig(options?: {
  cloudflare?: boolean
  prerender?: boolean
}): UserConfigFnObject
