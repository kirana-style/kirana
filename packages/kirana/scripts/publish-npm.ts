/**
 * Publishes the packed tarballs (`bun run kirana:pack --natives <dir>`) to npm as one release: every
 * package first under the `staging` dist-tag, in dependency order, then `latest` moves to the new
 * version on all of them once every edge of the registry can serve them.
 *
 *   bun scripts/publish-npm.ts <dir>             # publish
 *   bun scripts/publish-npm.ts <dir> --dry-run   # print the order and what would be skipped
 *
 * Why staged: npm's CDN caches a package's metadata for `max-age` (300 s), so for up to that long
 * after a publish an edge can serve a dependent's new version without its dependency's. Installs
 * follow `latest`, and `latest` moves only once every version has been published for longer than
 * that, so no install sees a new package without the new packages it depends on, and a release that
 * stops halfway leaves `latest` on the previous version.
 *
 * A version already on the registry is skipped and a tag already moved is moved again harmlessly, so
 * a release that failed halfway can run again. A prerelease (`0.2.0-rc.1`) moves `next`, never
 * `latest`. In CI, npm authenticates with trusted publishing (OIDC) and attaches provenance; moving a
 * tag needs "Allow npm dist-tag" on each package's trusted publisher and npm 11.21 or later.
 */
import { spawnSync } from "node:child_process"
import { readdirSync } from "node:fs"
import path from "node:path"

const [directory, ...flags] = process.argv.slice(2)
if (!directory) {
  console.error("usage: bun scripts/publish-npm.ts <dir> [--dry-run]")
  process.exit(2)
}
const dryRun = flags.includes("--dry-run")

const REGISTRY = "https://registry.npmjs.org"
const STAGING = "staging"

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

/** Whether the registry holds a version. This endpoint is not cached at the edge. */
async function published({ name, version }: Tarball): Promise<boolean> {
  const response = await fetch(`${url(name)}/${version}`, {
    signal: AbortSignal.timeout(15_000),
  })
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** The tag a version ends on. */
const finalTag = (version: string) =>
  version.includes("-") ? "next" : "latest"

// 1. Publish what is missing, under `staging`.
let lastPublish = 0
for (const tarball of order) {
  const spec = `${tarball.name}@${tarball.version}`
  if (await published(tarball)) {
    console.log(`skip     ${spec} (already published)`)
    continue
  }
  if (dryRun) {
    console.log(
      `publish  ${spec} --tag ${STAGING}, then ${finalTag(tarball.version)}`
    )
    continue
  }
  const result = spawnSync(
    "npm",
    ["publish", tarball.file, "--access", "public", "--tag", STAGING],
    { stdio: "inherit" }
  )
  if (result.status !== 0) {
    console.error(`failed   ${spec}`)
    process.exit(1)
  }
  lastPublish = Date.now()
  console.log(`done     ${spec}`)
}
if (dryRun) process.exit(0)

// 2. Wait until this edge serves every version, and until every edge must: none has kept the old
//    metadata longer than `max-age` past the last publish. Every package is asked at once.
const DEADLINE = Date.now() + 20 * 60_000
let pause = 5_000
for (;;) {
  const missing: string[] = []
  await Promise.all(
    order.map(async ({ name, version }) => {
      try {
        if (!(await versions(name)).has(version)) missing.push(name)
      } catch (error) {
        missing.push(`${name} (${(error as Error).message})`)
      }
    })
  )
  const settles = lastPublish + maxAge * 1000
  if (missing.length === 0 && Date.now() >= settles) break
  if (Date.now() > DEADLINE) {
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

// 3. Move the final tag, dependencies first, and drop `staging`.
const unmoved: string[] = []
for (const tarball of order) {
  const spec = `${tarball.name}@${tarball.version}`
  const tag = finalTag(tarball.version)
  const result = run("npm", ["dist-tag", "add", spec, tag])
  if (result.status !== 0) {
    console.error(result.stderr.trim())
    unmoved.push(`npm dist-tag add ${spec} ${tag}`)
    continue
  }
  console.log(`${tag.padEnd(8)} ${spec}`)
  // Best effort: a leftover `staging` tag is harmless, and on a re-run it may be gone already.
  run("npm", ["dist-tag", "rm", tarball.name, STAGING])
}
if (unmoved.length > 0) {
  console.error(
    `failed   every version is published under \`${STAGING}\`, but these tags did not move. Check "Allow npm dist-tag" on each package's trusted publisher and re-run the job, or run them signed in as kirana-maintainer:\n${unmoved.join("\n")}`
  )
  process.exit(1)
}
