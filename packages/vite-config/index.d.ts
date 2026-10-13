import type { UserConfigFnObject } from "vite"

/**
 * The Vite config every app in this repo shares. `cloudflare: true` builds the app as a Cloudflare
 * Worker (its `wrangler.jsonc`) and runs the server half in workerd during `vite dev` too.
 */
export function defineAppConfig(options?: {
  cloudflare?: boolean
}): UserConfigFnObject
