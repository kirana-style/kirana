/**
 * A page from an older build, open across a deploy: each deploy replaces the site's static assets, so
 * a chunk the old page imports on navigation is gone, and its URL answers with the 404 page. The page
 * itself is current again once it reloads, since HTML is revalidated on every request.
 */

/** The messages Chromium, Firefox and Safari give for a module import that failed to load. */
const STALE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i

/** Whether `error` is a chunk from another build that failed to load. */
export function isStaleBuildError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : ""
  return STALE.test(message)
}

/** The storage a reload remembers itself in, and the page's address. */
export type ReloadHost = {
  href: string
  reload: () => void
  storage?: Pick<Storage, "getItem" | "setItem"> | undefined
  now: () => number
}

const KEY = "kirana:stale-build-reload"

/**
 * Reloads the page once for a stale chunk; false, and no reload, when this address reloaded for one in
 * the last ten seconds, so a file that is missing for another reason shows its error instead of
 * reloading forever. Without storage (a private window that refuses it) it reloads.
 */
export function reloadOnce(host: ReloadHost): boolean {
  let last: { href?: string; at?: number } = {}
  try {
    last = JSON.parse(host.storage?.getItem(KEY) ?? "{}") as typeof last
  } catch {
    last = {}
  }
  if (last.href === host.href && host.now() - (last.at ?? 0) < 10_000)
    return false
  try {
    host.storage?.setItem(
      KEY,
      JSON.stringify({ href: host.href, at: host.now() })
    )
  } catch {
    // Storage refused: the reload still happens, unguarded.
  }
  host.reload()
  return true
}
