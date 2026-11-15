/**
 * Publishes the packed tarballs (`bun run kirana:pack --natives <dir>`) to npm as one release, each
 * package straight under its final tag (`latest`, or `next` for a prerelease), one dependency level
 * at a time.
 *
 *   bun scripts/publish-npm.ts <dir>             # publish
 *   bun scripts/publish-npm.ts <dir> --dry-run   # print the levels and what would be skipped
 *
 * 1. **Nothing is published unless everything can be.** Trusted publishing (OIDC) exchanges the
 *    workflow's identity for a token per package, and `npm publish` reports a package with no
 *    matching trusted publisher only as an E404 on its upload, after the packages before it are
 *    out. So the exchange is asked for every package first (`exchangeRequest`), and the release
 *    stops there, with the refused packages named. The job writes no `.npmrc` (`setup-node` without
 *    `registry-url`): a placeholder token there is what npm falls back to after a refused exchange.
 *
 * 2. **Nobody installs a package before the packages it names.** npm's CDN serves a package's list
 *    of versions from its cache for `max-age` (read from the registry's own answers; 300 s), and
 *    every sibling is named by the release's exact version. So a level is published once that time
 *    has passed since the level before it was, and this runner's edge lists it. Within a level the
 *    packages are uploaded at once. Why the levels are five, and cannot be fewer while the siblings
 *    are pinned, is in `dependencyLevels` (`npm-release.ts`).
 *
 * 3. **Nothing is waited for at the end.** Until an edge's cache runs out it serves the previous
 *    release whole, a working one, since every package names its family by exact version. What
 *    installs the release next waits for the edge it reaches itself, at most `max-age`: `verify`
 *    reads every package as an installer does (`verify-release.ts`), and the `bench` job dispatches
 *    kirana-lab at the `served-at` time this script writes to the job's outputs, when no edge can
 *    still serve the old lists. 0.4.1 showed why: the lab installed straight after the last
 *    publish and got a 404 for `@kirana-style/vite`'s tarball four minutes later.
 *
 * 4. **It can always be run again.** A version already published is skipped (or its tag moved
 *    forward), and a run that continues a release dates its wait from the registry's `time` for the
 *    versions an earlier run published, so it waits only for what is left. A registry that fails for
 *    its own reasons is asked again (`registry-retry.ts`), and a failed upload is first looked up
 *    on the registry, since a stored PUT can still be answered with an error.
 *
 * The final tag is used directly because `npm dist-tag` fails with E401 under trusted publishing
 * although `npm publish` works. Outside GitHub Actions (a maintainer signed in to npm, for a first
 * publish) there is no exchange to ask, and packages are uploaded one at a time, so npm can ask for
 * the passkey of each.
 */
import { spawn, spawnSync } from "node:child_process"
import { appendFileSync, readdirSync } from "node:fs"
import path from "node:path"

import {
  REGISTRY,
  dependencyLevels,
  escapedName,
  exchangeRequest,
  finalTag,
  identityRequest,
  later,
  listedTarball,
  maxAgeOf,
  publishArgs,
  publishedTime,
  retryDelay,
  settlesAt,
  siblings,
  trustedPublishing,
} from "./npm-release.ts"
import type { Manifest } from "./npm-release.ts"
import { RETRY_DELAYS, transientStatus } from "./registry-retry.ts"

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

/** A tarball's own manifest, read without unpacking it. */
function manifest(file: string): Tarball {
  const read = spawnSync("tar", ["-xzOf", file, "package/package.json"], {
    encoding: "utf8",
  })
  if (read.status !== 0) throw new Error(`cannot read ${file}: ${read.stderr}`)
  const json = JSON.parse(read.stdout) as Manifest
  return {
    file,
    name: json.name,
    version: json.version,
    depends: siblings(json),
  }
}

const tarballs = readdirSync(directory)
  .filter((file) => file.endsWith(".tgz"))
  // An absolute path: npm reads a relative `dir/name.tgz` as a GitHub `user/repo` and tries to clone it.
  .map((file) => manifest(path.resolve(directory, file)))
const levels = dependencyLevels(tarballs)

const url = (name: string) => `${REGISTRY}/${escapedName(name)}`
const spec = ({ name, version }: Tarball) => `${name}@${version}`

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** A registry request, asked again while the registry fails for its own reasons. */
async function registryFetch(
  target: string,
  init?: RequestInit
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const delay = RETRY_DELAYS[attempt]
    let failure: string
    try {
      const response = await fetch(target, {
        ...init,
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
async function held({ name, version }: Tarball): Promise<boolean> {
  const response = await registryFetch(`${url(name)}/${version}`)
  if (response.status === 404) return false
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`)
  return true
}

/** How long an edge may serve metadata it cached, read from the registry's own responses. */
let maxAge = 300

/** What an installer reads (the abbreviated metadata), from the edge this runner reaches. */
async function listing(name: string): Promise<unknown> {
  const response = await fetch(url(name), {
    headers: { Accept: "application/vnd.npm.install-v1+json" },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  maxAge = Math.max(
    maxAge,
    maxAgeOf(response.headers.get("cache-control")) ?? 0
  )
  return response.json()
}

/**
 * When the registry says a version was published, for one an earlier run published: read from the
 * full metadata this edge serves, `undefined` while that does not hold the version yet.
 */
async function registryDate({
  name,
  version,
}: Tarball): Promise<number | undefined> {
  try {
    const response = await registryFetch(url(name))
    if (!response.ok) return undefined
    return publishedTime(await response.json(), version)
  } catch {
    return undefined
  }
}

/** When each package was published by this run. */
const publishedHere = new Map<string, number>()

/** A level's publish dates: this run's, else the registry's (`settlesAt`). */
const dates = (level: readonly Tarball[]) =>
  Promise.all(
    level.map(
      async (each) => publishedHere.get(each.name) ?? (await registryDate(each))
    )
  )

/**
 * Whether this edge serves a tarball. Asked only once the metadata has settled, when it should be
 * there: an edge that cached a 404 from an earlier ask would hand it to the next installer.
 */
async function servesTarball(tarball: string): Promise<boolean> {
  const response = await fetch(tarball, {
    method: "HEAD",
    signal: AbortSignal.timeout(15_000),
  })
  return response.ok
}

/** The dist-tags of a package, from the registry (not cached at the edge). */
async function tags(name: string): Promise<Record<string, string>> {
  const response = await registryFetch(
    `${REGISTRY}/-/package/${encodeURIComponent(name)}/dist-tags`
  )
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`)
  return (await response.json()) as Record<string, string>
}

/**
 * Wait until no edge can serve `level` without the release (`settlesAt`), and this edge lists every
 * version of it and serves every tarball. Every package is asked at once.
 */
async function settle(level: readonly Tarball[], index: number) {
  const asked = Date.now()
  const known = await dates(level)
  const deadline = asked + 20 * 60_000
  let pause = 5_000
  for (;;) {
    const missing: string[] = []
    const served: { name: string; tarball: string }[] = []
    await Promise.all(
      level.map(async ({ name, version }) => {
        try {
          const tarball = listedTarball(await listing(name), version)
          if (tarball === undefined) missing.push(name)
          else served.push({ name, tarball })
        } catch (error) {
          missing.push(`${name} (${(error as Error).message})`)
        }
      })
    )
    const settles = settlesAt(known, asked, maxAge)
    if (missing.length === 0 && Date.now() >= settles)
      await Promise.all(
        served.map(async ({ name, tarball }) => {
          try {
            if (!(await servesTarball(tarball)))
              missing.push(`${name} (its tarball)`)
          } catch (error) {
            missing.push(`${name}'s tarball (${(error as Error).message})`)
          }
        })
      )
    if (missing.length === 0 && Date.now() >= settles) return
    if (Date.now() > deadline) {
      console.error(
        `failed   published but not served after 20 minutes: ${missing.join(", ")}.\n` +
          `         Nothing after level ${index} was published. Run the job again: it continues.`
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
        `waiting  ${Math.ceil(wait / 1000)} s: until then an edge may serve level ${index} without its new versions`
      )
      await sleep(wait)
    }
  }
}

/**
 * The workflow's identity for npm, or `undefined` outside GitHub Actions. In a workflow without
 * `id-token: write`, npm would have no login at all: the release stops here instead.
 */
async function identity(): Promise<string | undefined> {
  const { ACTIONS_ID_TOKEN_REQUEST_URL, ACTIONS_ID_TOKEN_REQUEST_TOKEN } =
    process.env
  if (!ACTIONS_ID_TOKEN_REQUEST_URL || !ACTIONS_ID_TOKEN_REQUEST_TOKEN) {
    if (process.env.GITHUB_ACTIONS !== "true") return undefined
    console.error(
      "refused  nothing was published: the job has no identity for npm (it needs `id-token: write`)"
    )
    process.exit(1)
  }
  const request = identityRequest(
    ACTIONS_ID_TOKEN_REQUEST_URL,
    ACTIONS_ID_TOKEN_REQUEST_TOKEN
  )
  const response = await registryFetch(request.url, request.init)
  if (!response.ok)
    throw new Error(`GitHub gave no identity token: HTTP ${response.status}`)
  return ((await response.json()) as { value: string }).value
}

/** Stops the release, before any upload, when npm refuses this workflow any package. */
async function authorize(pending: readonly Tarball[], token: string) {
  const npm = spawnSync("npm", ["--version"], {
    encoding: "utf8",
  }).stdout.trim()
  if (!trustedPublishing(npm)) {
    console.error(
      `refused  nothing was published: trusted publishing needs npm 11.5.1 or later, this is ${npm}`
    )
    process.exit(1)
  }
  const refused: string[] = []
  await Promise.all(
    pending.map(async ({ name }) => {
      const request = exchangeRequest(name, token)
      const response = await registryFetch(request.url, request.init)
      if (response.ok) return
      const body = (await response.json().catch(() => ({}))) as {
        message?: string
      }
      refused.push(
        `${name}: HTTP ${response.status} ${body.message ?? ""}`.trim()
      )
    })
  )
  if (refused.length === 0) {
    console.log(
      `allowed  npm ${npm} may publish all ${pending.length} packages for this workflow`
    )
    return
  }
  console.error(
    `refused  nothing was published. npm does not let this workflow publish:\n` +
      refused
        .sort()
        .map((each) => `           ${each}`)
        .join("\n") +
      `\n         Each needs a trusted publisher (npmjs.com, the package, Settings): repository\n` +
      `         kirana-style/kirana, workflow release.yml, environment release. A package new to npm\n` +
      `         has none until it exists: publish a 0.0.0 placeholder by hand and give it one.`
  )
  process.exit(1)
}

/**
 * One `npm publish`. Together with others (a level at once), its output is printed in one piece when
 * it ends; alone, it streams, so a maintainer signed in by hand sees npm's passkey prompt.
 */
function npmPublish(
  tarball: Tarball,
  tag: string,
  together: boolean
): Promise<{ status: number | null; output: string }> {
  const child = spawn("npm", publishArgs(tarball.file, tag), {
    stdio: [together ? "ignore" : "inherit", "pipe", "pipe"],
  })
  let output = ""
  const keep = (stream: NodeJS.WritableStream) => (chunk: Buffer) => {
    output += String(chunk)
    if (!together) stream.write(chunk)
  }
  child.stdout.on("data", keep(process.stdout))
  child.stderr.on("data", keep(process.stderr))
  return new Promise((resolve, reject) => {
    child.on("error", reject)
    child.on("close", (status) => {
      if (together) process.stdout.write(output)
      resolve({ status, output })
    })
  })
}

/** Uploads one package, asked again while the registry fails for its own reasons. */
async function publish(tarball: Tarball, tag: string, together: boolean) {
  for (let attempt = 0; ; attempt++) {
    const { status, output } = await npmPublish(tarball, tag, together)
    if (status !== 0 && (await held(tarball)))
      console.log(
        `landed   ${spec(tarball)}: npm reported a failure, the registry holds it`
      )
    else if (status !== 0) {
      const delay = retryDelay(attempt, output)
      const code = /npm (?:error|ERR!) code (\S+)/.exec(output)?.[1]
      if (delay === undefined)
        throw new Error(`${spec(tarball)} (${code ?? `exit ${status}`})`)
      console.log(
        `retry    ${spec(tarball)} (${code}) in ${delay} s (attempt ${attempt + 2} of ${RETRY_DELAYS.length + 1})`
      )
      await sleep(delay * 1000)
      continue
    }
    publishedHere.set(tarball.name, Date.now())
    console.log(`done     ${spec(tarball)} (${tag})`)
    return
  }
}

// The plan: what each level publishes, or moves the tag of; what is published is skipped.
type Step = { tarball: Tarball; tag: string; move: boolean }
const plan: Step[][] = []
for (const [index, members] of levels.entries()) {
  const steps: Step[] = []
  for (const tarball of members) {
    const tag = finalTag(tarball.version)
    if (!(await held(tarball))) {
      console.log(`plan     level ${index}  ${spec(tarball)} --tag ${tag}`)
      steps.push({ tarball, tag, move: false })
      continue
    }
    const current = (await tags(tarball.name))[tag]
    // Only ever forward: an older tarball never pulls the tag back.
    if (current !== undefined && !later(tarball.version, current)) {
      console.log(`skip     ${spec(tarball)} (already published)`)
      continue
    }
    // Published by an older, staged release whose tag never moved.
    console.log(
      `tag      ${spec(tarball)} ${tag} (published, tagged ${current ?? "nothing"})`
    )
    steps.push({ tarball, tag, move: true })
  }
  plan.push(steps)
}
const uploads = plan.flat().filter((step) => !step.move)
console.log(
  `release  ${uploads.length} of ${tarballs.length} packages to publish, in ${levels.length} levels`
)
if (dryRun) process.exit(0)

const token = uploads.length > 0 ? await identity() : undefined
if (token)
  await authorize(
    uploads.map((step) => step.tarball),
    token
  )
else if (uploads.length > 0)
  console.log(
    "by hand  no workflow identity: npm publishes as whoever is signed in, one package at a time"
  )

const started = Date.now()
const unmoved: string[] = []
for (const [index, steps] of plan.entries()) {
  const before = levels[index - 1]
  const publishing = steps.filter((step) => !step.move)
  // A level starts only once the one before it is complete, so the levels before that are older:
  // the one before is the one to wait for.
  if (before && publishing.length > 0) await settle(before, index - 1)
  for (const { tarball, tag } of steps.filter((step) => step.move)) {
    const moved = spawnSync("npm", ["dist-tag", "add", spec(tarball), tag], {
      encoding: "utf8",
    })
    if (moved.status === 0) console.log(`${tag.padEnd(8)} ${spec(tarball)}`)
    else {
      console.error(moved.stderr.trim())
      unmoved.push(`npm dist-tag add ${spec(tarball)} ${tag}`)
    }
  }
  const failed: string[] = []
  if (token) {
    const results = await Promise.allSettled(
      publishing.map(({ tarball, tag }) => publish(tarball, tag, true))
    )
    for (const result of results)
      if (result.status === "rejected")
        failed.push((result.reason as Error).message)
  } else {
    for (const { tarball, tag } of publishing)
      await publish(tarball, tag, false).catch((error: Error) =>
        failed.push(error.message)
      )
  }
  if (failed.length > 0) {
    console.error(
      `failed   not published: ${failed.sort().join(", ")}.\n` +
        `         Nothing after level ${index} was published. Run the job again: what is published is skipped.`
    )
    process.exit(1)
  }
}

// When no edge can serve the last level without the release: the `bench` job dispatches kirana-lab
// then, since the lab installs from an edge of its own.
const servedAt = Math.ceil(
  settlesAt(
    [...(await dates(levels.at(-1) ?? [])), ...publishedHere.values()],
    Date.now(),
    maxAge
  ) / 1000
)
console.log(
  `released ${publishedHere.size} packages in ${Math.round((Date.now() - started) / 1000)} s; ` +
    `every edge serves them by ${new Date(servedAt * 1000).toISOString()}`
)
if (process.env.GITHUB_OUTPUT)
  appendFileSync(process.env.GITHUB_OUTPUT, `served-at=${servedAt}\n`)

if (unmoved.length > 0) {
  console.error(
    `failed   these versions are published, but their tags did not move. Run them signed in as kirana-maintainer:\n${unmoved.join("\n")}`
  )
  process.exit(1)
}
