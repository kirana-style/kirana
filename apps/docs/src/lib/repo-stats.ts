/**
 * The project's public numbers: stars on GitHub and last week's downloads of the core package on
 * npm, from the site's own `/api/repo-stats` (`routes/api.repo-stats.ts`), which asks both APIs and
 * keeps the answer. The browser asks after the page has rendered; the page renders without the
 * numbers and nothing waits on them.
 *
 * One request per tab session: the answer is kept in sessionStorage, and every component that asks
 * shares the one promise. A failed request (offline) leaves the numbers out.
 */
import { useEffect, useState } from "react"

export type RepoStats = {
  stars?: number
  /** Downloads of the core package over the last seven days. */
  downloads?: number
}

const KEY = "kirana:repo-stats"

let pending: Promise<RepoStats> | undefined

const count = (value: unknown) =>
  typeof value === "number" ? value : undefined

async function ask(): Promise<RepoStats> {
  try {
    const response = await fetch("/api/repo-stats")
    if (!response.ok) return {}
    const body = (await response.json()) as Record<string, unknown>
    return { stars: count(body.stars), downloads: count(body.downloads) }
  } catch {
    return {}
  }
}

function load(): Promise<RepoStats> {
  try {
    const kept = sessionStorage.getItem(KEY)
    if (kept) return Promise.resolve(JSON.parse(kept) as RepoStats)
  } catch {}
  pending ??= ask().then((stats) => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(stats))
    } catch {}
    return stats
  })
  return pending
}

export function useRepoStats(): RepoStats {
  const [stats, setStats] = useState<RepoStats>({})
  useEffect(() => {
    let live = true
    void load().then((value) => {
      if (live) setStats(value)
    })
    return () => {
      live = false
    }
  }, [])
  return stats
}

/** 1234 → "1.2k", as a count reads at a glance. */
export function compact(value: number): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}
