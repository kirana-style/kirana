/**
 * Publishes the packed tarballs (`bun run kirana:pack --natives <dir>`) to npm, in dependency order:
 * the platform packages first, then each package after every `@kirana-style/*` package it depends
 * on is published and served, so no published version ever points at one that is not there yet.
 *
 *   bun scripts/publish-npm.ts <dir>             # publish
 *   bun scripts/publish-npm.ts <dir> --dry-run   # print the order and what would be skipped
 *
 * A version already on the registry is skipped, so a release that failed halfway can run again. A
 * prerelease (`0.2.0-rc.1`) goes to the `next` tag, never `latest`. In CI, npm authenticates with
 * trusted publishing (OIDC) and attaches provenance; no token is stored anywhere.
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

/** Whether the registry serves a version: asked afresh, past npm's local cache. */
const served = (spec: string) =>
  run("npm", ["view", spec, "version", "--prefer-online"]).stdout.trim() !== ""

/** What another tarball here depends on: it must install before any dependent is published. */
const required = new Set(tarballs.flatMap((tarball) => tarball.depends))

/**
 * npm can accept a publish and serve it many minutes later. A dependent published in that window
 * names a version nobody can install, so the next package waits, for up to half an hour.
 */
const ATTEMPTS = 60
const PAUSE = 30_000
async function untilServed(spec: string): Promise<boolean> {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    if (served(spec)) return true
    console.log(
      `waiting  ${spec} is not served yet, attempt ${attempt} of ${ATTEMPTS}`
    )
    await new Promise((resolve) => setTimeout(resolve, PAUSE))
  }
  return false
}

let failed = false
for (const tarball of order) {
  const spec = `${tarball.name}@${tarball.version}`
  if (served(spec)) {
    console.log(`skip     ${spec} (already published)`)
    continue
  }
  const tag = tarball.version.includes("-") ? "next" : "latest"
  if (dryRun) {
    console.log(`publish  ${spec} --tag ${tag}`)
    continue
  }
  const result = spawnSync(
    "npm",
    ["publish", tarball.file, "--access", "public", "--tag", tag],
    { stdio: "inherit" }
  )
  if (result.status !== 0) {
    console.error(`failed   ${spec}`)
    failed = true
    break
  }
  console.log(`done     ${spec}`)
  if (required.has(tarball.name) && !(await untilServed(spec))) {
    console.error(`failed   ${spec} was published but is still not served`)
    failed = true
    break
  }
}
process.exit(failed ? 1 : 0)
