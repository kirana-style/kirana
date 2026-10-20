/**
 * The project's public numbers: stars on GitHub and last week's downloads of the core package on
 * npm. Both APIs answer cross-origin requests without a key, so the browser asks them directly
 * after the page has rendered; the server renders without the numbers and nothing waits on them.
 *
 * One request per API per tab session: the answer is kept in sessionStorage, and every component
 * that asks shares the one promise. A failed request (offline, rate-limited) leaves the number out.
 */
import { useEffect, useState } from "react"

import { CORE_PACKAGE, REPOSITORY } from "@/data/links"

export type RepoStats = {
  stars?: number
  /** Downloads of the core package over the last seven days. */
  downloads?: number
}

const KEY = "kirana:repo-stats"

let pending: Promise<RepoStats> | undefined

async function number(url: string, read: (body: unknown) => unknown) {
  try {
    const response = await fetch(url)
    if (!response.ok) return undefined
    const value = read(await response.json())
    return typeof value === "number" ? value : undefined
  } catch {
    return undefined
  }
}

function load(): Promise<RepoStats> {
  try {
    const kept = sessionStorage.getItem(KEY)
    if (kept) return Promise.resolve(JSON.parse(kept) as RepoStats)
  } catch {}
  pending ??= Promise.all([
    number(
      `https://api.github.com/repos/${REPOSITORY}`,
      (body) => (body as { stargazers_count?: unknown }).stargazers_count
    ),
    number(
      `https://api.npmjs.org/downloads/point/last-week/${CORE_PACKAGE}`,
      (body) => (body as { downloads?: unknown }).downloads
    ),
  ]).then(([stars, downloads]) => {
    const stats = { stars, downloads }
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
