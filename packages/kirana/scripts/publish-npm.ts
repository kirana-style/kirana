/**
 * Publishes the packed tarballs (`bun run kirana:pack --natives <dir>`) to npm as one release, each
 * package straight under its final tag (`latest`, or `next` for a prerelease), one dependency level
 * at a time.
 *
 *   bun scripts/publish-npm.ts <dir>             # publish
 *   bun scripts/publish-npm.ts <dir> --dry-run   # print the levels and what would be skipped
 *
 * Why levels: npm's CDN caches a package's metadata for `max-age` (300 s), so for up to that long
 * after a publish an edge can serve a dependent's new version without its dependency's. A level is
 * published only once every edge must serve the level before it (served here, and `max-age` past
 * its last publish), so no install sees a new package without the new packages it depends on. A
 * release that stops halfway leaves every package it did not reach on its previous version, and
 * what it did publish already has its dependencies.
 *
 * Why not publish everything under a staging tag and move `latest` afterwards: in CI, npm
 * authenticates with trusted publishing (OIDC), and while `npm publish` works through it, moving a
 * tag with `npm dist-tag` failed with E401 on every package in 0.3.0 although each trusted publisher
 * allowed it. Publishing under the final tag needs nothing but the publish.
 *
 * A version already on the registry is skipped, so a release that failed halfway can run again. One
 * left on another tag by an older, staged release has its tag moved, and the command is printed when
 * npm refuses.
 *
 * A registry that fails for its own reasons (a 5xx, a rate limit, a dropped connection) is asked
 * again, after each of `RETRY_DELAYS` (`registry-retry.ts`): 0.3.1 stopped on one E503. A failed
 * publish is first checked against the registry, since a PUT can be stored and still answered with
 * an error, and publishing it again would then fail with E403.
 */
import { spawnSync } from "node:child_process"
import { readdirSync } from "node:fs"
import path from "node:path"

import {
  RETRY_DELAYS,
  transientNpmError,
  transientStatus,
} from "./registry-retry.ts"

const [directory, ...flags] = process.argv.slice(2)
if (!directory) {
  console.error("usage: bun scripts/publish-npm.ts <dir> [--dry-run]")
  process.exit(2)
}
const dryRun = flags.includes("--dry-run")

const REGISTRY = "https://registry.npmjs.org"

type Tarball = {
  file: string
  name: string
  version: string
  depends: string[]
}

function run(command: string, args: string[]) {
  return spawnSync(command, args, { encoding: "utf8" })
}

/** A tarball's own manifest, read without unpacking it. */
function manifest(file: string): Tarball {
  const read = run("tar", ["-xzOf", file, "package/package.json"])
  if (read.status !== 0) throw new Error(`cannot read ${file}: ${read.stderr}`)
  const json = JSON.parse(read.stdout) as {
    name: string
    version: string
    dependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
  }
  const depends = Object.keys({
    ...json.dependencies,
    ...json.peerDependencies,
    ...json.optionalDependencies,
  }).filter(
    (name) => name.startsWith("@kirana-style/") || name === "kirana-style"
  )
  return { file, name: json.name, version: json.version, depends }
}

const tarballs = readdirSync(directory)
  .filter((file) => file.endsWith(".tgz"))
  // An absolute path: npm reads a relative `dir/name.tgz` as a GitHub `user/repo` and tries to clone it.
  .map((file) => manifest(path.resolve(directory, file)))
const byName = new Map(tarballs.map((tarball) => [tarball.name, tarball]))

/** Depth-first: a package after everything it depends on that is published here too. */
const order: Tarball[] = []
const visiting = new Set<string>()
function visit(tarball: Tarball) {
  if (order.includes(tarball)) return
  if (visiting.has(tarball.name))
    throw new Error(`dependency cycle through ${tarball.name}`)
  visiting.add(tarball.name)
  for (const name of tarball.depends) {
    const dependency = byName.get(name)
    if (dependency) visit(dependency)
  }
  visiting.delete(tarball.name)
  order.push(tarball)
}
for (const tarball of [...tarballs].sort((a, b) =>
  a.name.localeCompare(b.name)
))
  visit(tarball)

const url = (name: string) => `${REGISTRY}/${encodeURIComponent(name)}`

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** A registry request, asked again while the registry fails for its own reasons. */
async function registryFetch(target: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const delay = RETRY_DELAYS[attempt]
    let failure: string
    try {
      const response = await fetch(target, {
        signal: AbortSignal.timeout(15_000),
      })
      if (!transientStatus(response.status) || delay === undefined)
        return response
      failure = `HTTP ${response.status}`
    } catch (error) {
      if (delay === undefined) throw error
      failure = (error as Error).message
    }
    console.log(`retry    ${target} (${failure}) in ${delay} s`)
    await sleep(delay * 1000)
  }
}

/** Whether the registry holds a version. This endpoint is not cached at the edge. */
async function published_({ name, version }: Tarball): Promise<boolean> {
  const response = await registryFetch(`${url(name)}/${version}`)
  if (response.status === 404) return false
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`)
  return true
}

/** How long an edge may serve metadata it cached, read from the registry's own responses. */
let maxAge = 300

/** What an installer reads (the abbreviated metadata), from the edge this runner reaches. */
async function versions(name: string): Promise<Set<string>> {
  const response = await fetch(url(name), {
    headers: { Accept: "application/vnd.npm.install-v1+json" },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const age = /max-age=(\d+)/.exec(response.headers.get("cache-control") ?? "")
  if (age) maxAge = Math.max(maxAge, Number(age[1]))
  const json = (await response.json()) as { versions: Record<string, unknown> }
  return new Set(Object.keys(json.versions))
}

/** The tag a version ends on. */
const finalTag = (version: string) =>
  version.includes("-") ? "next" : "latest"

/** Whether version `a` is later than `b` (`x.y.z`, a prerelease before its release). */
function later(a: string, b: string): boolean {
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

/** Each package's level: 0 for one that depends on nothing published here, else one past its deepest. */
const level = new Map<string, number>()
for (const tarball of order)
  level.set(
    tarball.name,
    Math.max(
      -1,
      ...tarball.depends
        .filter((name) => byName.has(name))
        .map((name) => level.get(name)!)
    ) + 1
  )
const levels: Tarball[][] = []
for (const tarball of order)
  (levels[level.get(tarball.name)!] ??= []).push(tarball)

/** The dist-tags of a package, from the registry (not cached at the edge). */
async function tags(name: string): Promise<Record<string, string>> {
  const response = await registryFetch(
    `${REGISTRY}/-/package/${encodeURIComponent(name)}/dist-tags`
  )
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`)
  return (await response.json()) as Record<string, string>
}

/**
 * Wait until this edge serves every version of `published`, and until every edge must: none has
 * kept the old metadata longer than `max-age` past `lastPublish`. Every package is asked at once.
 */
async function settle(published: readonly Tarball[], lastPublish: number) {
  const deadline = Date.now() + 20 * 60_000
  let pause = 5_000
  for (;;) {
    const missing: string[] = []
    await Promise.all(
      published.map(async ({ name, version }) => {
        try {
          if (!(await versions(name)).has(version)) missing.push(name)
        } catch (error) {
          missing.push(`${name} (${(error as Error).message})`)
        }
      })
    )
    const settles = lastPublish + maxAge * 1000
    if (missing.length === 0 && Date.now() >= settles) return
    if (Date.now() > deadline) {
      console.error(
        `failed   published but not served after 20 minutes: ${missing.join(", ")}`
      )
      process.exit(1)
    }
    if (missing.length > 0) {
      console.log(
        `waiting  not served yet: ${missing.sort().join(", ")}; next check in ${pause / 1000} s`
      )
      await sleep(pause)
      pause = Math.min(pause * 2, 30_000)
    } else {
      const wait = settles - Date.now()
      console.log(
        `waiting  every version is served here; ${Math.ceil(wait / 1000)} s until no edge can serve the old metadata`
      )
      await sleep(wait)
    }
  }
}

/** `npm publish`, asked again while the registry fails for its own reasons. */
async function publish(tarball: Tarball, spec: string, tag: string) {
  for (let attempt = 0; ; attempt++) {
    // stderr is read to tell a failing registry from a refused package; the rest streams as usual.
    const result = spawnSync(
      "npm",
      ["publish", tarball.file, "--access", "public", "--tag", tag],
      { stdio: ["inherit", "inherit", "pipe"], encoding: "utf8" }
    )
    process.stderr.write(result.stderr ?? "")
    if (result.status === 0) return
    if (await published_(tarball)) {
      console.log(
        `landed   ${spec}: npm reported a failure, the registry holds it`
      )
      return
    }
    const delay = RETRY_DELAYS[attempt]
    if (delay === undefined || !transientNpmError(result.stderr ?? "")) {
      console.error(`failed   ${spec}`)
      process.exit(1)
    }
    console.log(
      `retry    ${spec} in ${delay} s (attempt ${attempt + 2} of ${RETRY_DELAYS.length + 1})`
    )
    await sleep(delay * 1000)
  }
}

const unmoved: string[] = []
let previous: { published: Tarball[]; lastPublish: number } | undefined
for (const [index, members] of levels.entries()) {
  // The level before must be served everywhere before anything that depends on it is published.
  if (previous && previous.published.length > 0 && !dryRun)
    await settle(previous.published, previous.lastPublish)
  const published: Tarball[] = []
  let lastPublish = 0
  for (const tarball of members) {
    const spec = `${tarball.name}@${tarball.version}`
    const tag = finalTag(tarball.version)
    if (await published_(tarball)) {
      const current = (await tags(tarball.name))[tag]
      // Only ever forward: an older tarball never pulls the tag back.
      if (current !== undefined && !later(tarball.version, current)) {
        console.log(`skip     ${spec} (already published)`)
        continue
      }
      // Published by an older, staged release whose tag never moved.
      if (dryRun) {
        console.log(
          `tag      ${spec} ${tag} (published, tagged ${current ?? "nothing"})`
        )
        continue
      }
      const moved = run("npm", ["dist-tag", "add", spec, tag])
      if (moved.status === 0) console.log(`${tag.padEnd(8)} ${spec}`)
      else {
        console.error(moved.stderr.trim())
        unmoved.push(`npm dist-tag add ${spec} ${tag}`)
      }
      continue
    }
    if (dryRun) {
      console.log(`publish  ${spec} --tag ${tag} (level ${index})`)
      continue
    }
    await publish(tarball, spec, tag)
    lastPublish = Date.now()
    published.push(tarball)
    console.log(`done     ${spec} (${tag})`)
  }
  previous = { published, lastPublish }
}
if (unmoved.length > 0) {
  console.error(
    `failed   these versions are published, but their tags did not move. Run them signed in as kirana-maintainer:\n${unmoved.join("\n")}`
  )
  process.exit(1)
}
