/**
 * What the npm release (`publish-npm.ts`) decides, apart from the requests it sends, so each
 * decision is tested on its own (`test/npm-release.test.ts`): the dependency levels, how long a
 * level waits, the token exchange it asks npm before any upload, and when an upload is tried again.
 */
import { RETRY_DELAYS, transientNpmError } from "./registry-retry.ts"

export const REGISTRY = "https://registry.npmjs.org"

/** The fields of a package's manifest that name other packages. */
export type Manifest = {
  name: string
  version: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

/**
 * The Kirana packages a published manifest names, by any of the three fields an installer reads.
 *
 * Each one counts, because each names its sibling by the release's exact version (`pack.ts` writes
 * `workspace:*` as the version, the engines as `optionalDependencies` of `@kirana-style/compiler` at
 * the version, and `@kirana-style/compiler-browser`'s peer on the core at the version), and a list
 * of versions an edge cached before the release does not hold that version:
 *
 * - a dependency: the install stops with ETARGET;
 * - an optional dependency (the engines): npm drops it without a word, and `@kirana-style/compiler`
 *   installs without its engine, which fails only when it runs. The worst of the three;
 * - a peer (`@kirana-style/angular` and `@kirana-style/ember` on `@kirana-style/vite`, optional):
 *   a project that has both and updates them gets a peer conflict (ERESOLVE).
 *
 * A peer range the previous release satisfies would need no level; none is written that way.
 */
export function siblings(manifest: Manifest): string[] {
  return Object.keys({
    ...manifest.dependencies,
    ...manifest.peerDependencies,
    ...manifest.optionalDependencies,
  }).filter(
    (name) => name.startsWith("@kirana-style/") || name === "kirana-style"
  )
}

/**
 * The packages in dependency levels: 0 for one that names nothing published with it, else one past
 * the deepest it names. A level is published once no edge can serve the level before it without the
 * release (`settlesAt`), so the release waits one cache age per level after the first.
 *
 * Counted again for KF-122, the count stays five, four waits: every edge between siblings needs
 * the order (`siblings`), and the longest chain is made of plain dependencies, which no reading of
 * the peers shortens:
 *
 *   core, the engines → compiler → rolldown, webpack, postcss → vite, next, gatsby → astro
 *
 * Fewer levels need a sibling named by a range the previous release satisfies, which is a change to
 * what the packages promise (KF-048 made every sibling the release's own version), not to this script.
 * Within a level, packages are sorted by name, so a plan reads the same on every run.
 */
export function dependencyLevels<
  T extends { name: string; depends: readonly string[] },
>(packages: readonly T[]): T[][] {
  const byName = new Map(packages.map((each) => [each.name, each]))
  const depth = new Map<string, number>()
  const level = (each: T, seen: readonly string[]): number => {
    const known = depth.get(each.name)
    if (known !== undefined) return known
    if (seen.includes(each.name))
      throw new Error(`dependency cycle through ${each.name}`)
    const own =
      Math.max(
        -1,
        ...each.depends
          .map((name) => byName.get(name))
          .filter((named) => named !== undefined)
          .map((named) => level(named, [...seen, each.name]))
      ) + 1
    depth.set(each.name, own)
    return own
  }
  const levels: T[][] = []
  for (const each of [...packages].sort((a, b) => a.name.localeCompare(b.name)))
    (levels[level(each, [])] ??= []).push(each)
  return levels
}

/** How long an edge may serve what it cached, in seconds, from a response's `cache-control`. */
export function maxAgeOf(cacheControl: string | null): number | undefined {
  const age = /max-age=(\d+)/.exec(cacheControl ?? "")
  return age ? Number(age[1]) : undefined
}

/**
 * When no edge can still serve a level's old list of versions: `maxAge` seconds after the latest
 * of its publishes. A date is this run's own, else the registry's `time` for the version (an earlier
 * run published it, and this run continues the release), else unknown: an edge that does not list
 * the version yet. An unknown date is counted as `now`, the time the level was first asked about.
 */
export function settlesAt(
  dates: readonly (number | undefined)[],
  now: number,
  maxAge: number
): number {
  return Math.max(...dates.map((date) => date ?? now)) + maxAge * 1000
}

/** A package's name as npm writes it in a URL (`@kirana-style%2fcore`, npm-package-arg's `escapedName`). A valid name has one slash at most; `replaceAll` keeps an invalid one from reaching the URL half escaped. */
export function escapedName(name: string): string {
  return name.replaceAll("/", "%2f")
}

type Request = { url: string; init: RequestInit }

/**
 * The workflow's identity token, asked of GitHub for the registry's audience: the request npm's own
 * client makes (`lib/utils/oidc.js`) from `ACTIONS_ID_TOKEN_REQUEST_URL` and `_TOKEN`.
 */
export function identityRequest(
  requestUrl: string,
  requestToken: string,
  registry = REGISTRY
): Request {
  const url = new URL(requestUrl)
  url.searchParams.append("audience", `npm:${new URL(registry).hostname}`)
  return {
    url: url.href,
    init: {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${requestToken}`,
      },
    },
  }
}

/**
 * The exchange `npm publish` asks before its upload: the identity token for a token that may publish
 * one package. npm logs a refusal at `verbose` only and then uploads with whatever token it has, so
 * a package with no matching trusted publisher shows as an E404 on its upload. Asked first, for every
 * package, it names the refused ones before anything is published.
 */
export function exchangeRequest(
  name: string,
  idToken: string,
  registry = REGISTRY
): Request {
  return {
    url: `${registry}/-/npm/v1/oidc/token/exchange/package/${escapedName(name)}`,
    init: {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    },
  }
}

/** Whether an npm can publish by trusted publishing: 11.5.1 or later. */
export function trustedPublishing(npmVersion: string): boolean {
  const [major = 0, minor = 0, patch = 0] = npmVersion
    .trim()
    .split(/[.-]/)
    .map(Number)
  if (major !== 11) return major > 11
  return minor > 5 || (minor === 5 && patch >= 1)
}

/**
 * `npm publish`'s arguments. `--fetch-retries 0`: one request per attempt. npm's own retries are not
 * logged, and once the registry has stored an upload they fail with "cannot publish over"; the
 * retries are this script's (`retryDelay`), each logged.
 */
export function publishArgs(file: string, tag: string): string[] {
  return [
    "publish",
    file,
    "--access",
    "public",
    "--tag",
    tag,
    "--fetch-retries",
    "0",
  ]
}

/**
 * Seconds to wait before attempt `attempt + 1` of an upload npm failed, from its output, or
 * `undefined` to stop: a refusal another attempt would meet again, or no attempts left.
 */
export function retryDelay(
  attempt: number,
  output: string
): number | undefined {
  if (!transientNpmError(output)) return undefined
  return RETRY_DELAYS[attempt]
}

/** The tag a version ends on. */
export function finalTag(version: string): "latest" | "next" {
  return version.includes("-") ? "next" : "latest"
}

/** Whether version `a` is later than `b` (`x.y.z`, a prerelease before its release). */
export function later(a: string, b: string): boolean {
  const parse = (version: string) => {
    const [core = "", pre] = version.split("-", 2)
    return { parts: core.split(".").map(Number), pre }
  }
  const [x, y] = [parse(a), parse(b)]
  for (let index = 0; index < 3; index++) {
    const difference = (x.parts[index] ?? 0) - (y.parts[index] ?? 0)
    if (difference !== 0) return difference > 0
  }
  if (x.pre === y.pre) return false
  if (x.pre === undefined) return true
  if (y.pre === undefined) return false
  return x.pre.localeCompare(y.pre, "en", { numeric: true }) > 0
}

/**
 * The tarball an installer would fetch for `version`, from the list of versions an edge served
 * (the abbreviated metadata), or `undefined` when that list does not hold the version yet.
 */
export function listedTarball(
  listing: unknown,
  version: string
): string | undefined {
  const versions = (
    listing as { versions?: Record<string, { dist?: { tarball?: string } }> }
  )?.versions
  return versions?.[version]?.dist?.tarball
}

/** The registry's date for a version, from a package's full metadata (`time`), in ms. */
export function publishedTime(
  metadata: unknown,
  version: string
): number | undefined {
  const date = (metadata as { time?: Record<string, string> })?.time?.[version]
  if (date === undefined) return undefined
  const time = Date.parse(date)
  return Number.isNaN(time) ? undefined : time
}
