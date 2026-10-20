/**
 * The project's public numbers (`lib/repo-stats.ts`): stars on GitHub and last week's downloads of
 * the core package on npm, as JSON. The Worker asks both APIs and keeps the answer in Cloudflare's
 * cache, so a reader's browser never calls GitHub. GitHub allows 60 calls an hour without a key per
 * address, which a shared address (an office, a page-speed service) runs out of, and a browser
 * logs the refused call as an error. A number either API does not give is left out.
 */
import { createFileRoute } from "@tanstack/react-router"

import { CORE_PACKAGE, REPOSITORY } from "@/data/links"

/** How long an answer is kept: an hour with both numbers, five minutes with one missing. */
const KEPT = { complete: 3600, partial: 300 }

async function number(url: string, read: (body: unknown) => unknown) {
  try {
    // GitHub refuses a call that names no user agent.
    const response = await fetch(url, {
      headers: { "User-Agent": "kirana.style" },
    })
    if (!response.ok) return undefined
    const value = read(await response.json())
    return typeof value === "number" ? value : undefined
  } catch {
    return undefined
  }
}

/** Cloudflare's cache for this Worker, where the runtime has one. */
function cache(): Cache | undefined {
  return typeof caches === "undefined"
    ? undefined
    : (caches as unknown as { default?: Cache }).default
}

export const Route = createFileRoute("/api/repo-stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = new Request(new URL("/api/repo-stats", request.url))
        const kept = await cache()?.match(key)
        if (kept) return kept
        const [stars, downloads] = await Promise.all([
          number(
            `https://api.github.com/repos/${REPOSITORY}`,
            (body) => (body as { stargazers_count?: unknown }).stargazers_count
          ),
          number(
            `https://api.npmjs.org/downloads/point/last-week/${CORE_PACKAGE}`,
            (body) => (body as { downloads?: unknown }).downloads
          ),
        ])
        const age =
          stars === undefined || downloads === undefined
            ? KEPT.partial
            : KEPT.complete
        const response = Response.json(
          { stars, downloads },
          { headers: { "Cache-Control": `public, max-age=${age}` } }
        )
        await cache()?.put(key, response.clone())
        return response
      },
    },
  },
})
