/**
 * Takes the newest benchmark run from kirana-lab (https://github.com/kirana-style/kirana-lab) and
 * writes it to `src/data/benchmarks.json`, the only source of the site's measured numbers.
 *
 * The lab publishes each run as a release, `bench-<version>-<date>-<run>`, with `results.json` and
 * `report.md`. A run whose conformance failed is a pre-release, and its numbers are not taken: they
 * measured builds that do not render alike. The file keeps every cell's summary, every comparison
 * and the run's metadata; the raw samples stay in the release, which the site links.
 *
 *   bun scripts/take-benchmarks.ts               the newest release whose conformance passed
 *   bun scripts/take-benchmarks.ts --tag <tag>   that release
 *
 * GITHUB_TOKEN, when set, is sent to GitHub's API, which limits anonymous calls.
 */
import { readFile, writeFile } from "node:fs/promises"

const LAB = "kirana-style/kirana-lab"
const out = new URL("../src/data/benchmarks.json", import.meta.url).pathname

const args = process.argv.slice(2)
const tagIndex = args.indexOf("--tag")
const wanted = tagIndex >= 0 ? args[tagIndex + 1] : undefined

type Release = {
  tag_name: string
  html_url: string
  draft: boolean
  prerelease: boolean
  published_at: string
  assets: { name: string; browser_download_url: string }[]
}

async function get(url: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  }
  if (process.env.GITHUB_TOKEN && url.startsWith("https://api.github.com/"))
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const response = await fetch(url, { headers })
  if (!response.ok)
    throw new Error(`${url}: ${response.status} ${response.statusText}`)
  return response
}

const releases = (await (
  await get(`https://api.github.com/repos/${LAB}/releases?per_page=50`)
).json()) as Release[]

const release = releases
  .filter((entry) =>
    wanted
      ? entry.tag_name === wanted
      : entry.tag_name.startsWith("bench-") && !entry.draft && !entry.prerelease
  )
  .sort((a, b) => b.published_at.localeCompare(a.published_at))[0]
if (!release)
  throw new Error(
    wanted
      ? `${LAB} has no release ${wanted}`
      : `${LAB} has no benchmark release whose conformance passed`
  )

const asset = (name: string) => {
  const found = release.assets.find((entry) => entry.name === name)
  if (!found) throw new Error(`${release.tag_name} has no ${name}`)
  return found.browser_download_url
}

const results = (await (await get(asset("results.json"))).json()) as {
  meta: { kirana: string; conformance: Record<string, string> }
  rows: Record<string, unknown>[]
  comparisons: Record<string, unknown>[]
}

const failed = Object.entries(results.meta.conformance).filter(
  ([, outcome]) => outcome !== "passed"
)
if (failed.length > 0)
  throw new Error(
    `${release.tag_name}: conformance did not pass for ${failed.map(([app]) => app).join(", ")}`
  )

/** Six significant figures: more than any page shows, and a file a page can load. */
const round = (value: unknown): unknown =>
  typeof value === "number" && !Number.isInteger(value)
    ? Number(value.toPrecision(6))
    : value
const rounded = (entry: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(entry).map(([key, value]) => [key, round(value)])
  )

const data = {
  source: {
    tag: release.tag_name,
    release: release.html_url,
    results: asset("results.json"),
    report: asset("report.md"),
  },
  meta: results.meta,
  rows: results.rows.map(({ samples: _samples, labels: _labels, ...row }) =>
    rounded(row)
  ),
  comparisons: results.comparisons.map(rounded),
}
const text = `${JSON.stringify(data, null, 2)}\n`

const current = await readFile(out, "utf8").catch(() => "")
if (current === text) {
  console.log(`already ${release.tag_name}`)
} else {
  await writeFile(out, text)
  console.log(`took ${release.tag_name} (Kirana ${results.meta.kirana})`)
}
