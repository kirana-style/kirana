/**
 * After a release, asks every registry for the version it was meant to receive, so a target that
 * quietly did not publish shows as a failed job instead of being found later. Read-only: public
 * APIs, no credentials.
 *
 *   bun scripts/verify-release.ts v0.2.0            # every target, retrying while registries index
 *   bun scripts/verify-release.ts v0.2.0 --once     # one pass, no retries
 *
 * npm (every package, the engines included), RubyGems, Hex and Packagist (the mirror and the alias)
 * must have it. Open VSX (which answers 404 while an upload is held for review) and the VS Code
 * Marketplace (uploaded by hand without a VSCE_PAT) only report, and never keep the retries going.
 */
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { TARGETS } from "./pack.ts"

const [tag, ...flags] = process.argv.slice(2)
if (!tag?.startsWith("v")) {
  console.error("usage: bun scripts/verify-release.ts v<version> [--once]")
  process.exit(2)
}
const version = tag.slice(1)
const once = flags.includes("--once")

const root = path.resolve(import.meta.dirname, "..")
const npmPackages = [
  ...readdirSync(path.join(root, "npm")).map(
    (directory) =>
      (
        JSON.parse(
          readFileSync(
            path.join(root, "npm", directory, "package.json"),
            "utf8"
          )
        ) as { name: string }
      ).name
  ),
  ...[...Object.keys(TARGETS), "wasm32-wasi"].map(
    (triple) => `@kirana-style/compiler-${triple}`
  ),
].sort()

type Check = {
  name: string
  /** True when the registry serves the version. */
  has: () => Promise<boolean>
  /** Reported when missing, never failing: the annotation and its explanation. */
  optional?: { level: "warning" | "notice"; why: string }
}

async function json(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15_000),
  })
  if (response.status === 404) return undefined
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response.json()
}

/** Packagist's `p2` metadata: every tagged version of a package. */
async function packagist(name: string): Promise<boolean> {
  const data = (await json(`https://repo.packagist.org/p2/${name}.json`)) as
    | { packages: Record<string, { version: string }[]> }
    | undefined
  return Object.values(data?.packages ?? {})
    .flat()
    .some((entry) => entry.version === tag || entry.version === version)
}

const checks: Check[] = [
  ...npmPackages.map((name) => ({
    name: `npm ${name}`,
    has: async () =>
      Boolean(
        await json(
          `https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`
        )
      ),
  })),
  {
    name: "RubyGems kirana",
    has: async () =>
      (
        ((await json("https://rubygems.org/api/v1/versions/kirana.json")) ??
          []) as { number: string }[]
      ).some((entry) => entry.number === version),
  },
  {
    name: "Hex kirana",
    has: async () =>
      (
        (
          (await json("https://hex.pm/api/packages/kirana")) as
            | { releases: { version: string }[] }
            | undefined
        )?.releases ?? []
      ).some((entry) => entry.version === version),
  },
  {
    name: "Open VSX kirana-style.kirana",
    optional: {
      level: "warning",
      why: 'the upload was accepted (the editors job passed), so it is most likely held for review: open-vsx.org shows it as "Under review" until it clears. Nothing to re-run.',
    },
    has: async () =>
      Boolean(
        await json(`https://open-vsx.org/api/kirana-style/kirana/${version}`)
      ),
  },
  {
    name: "Packagist kirana-style/kirana",
    has: () => packagist("kirana-style/kirana"),
  },
  { name: "Packagist kirana/kirana", has: () => packagist("kirana/kirana") },
  {
    name: "VS Code Marketplace kirana-style.kirana",
    optional: {
      level: "notice",
      why: `upload the .vsix from the ${tag} GitHub release by hand.`,
    },
    has: async () => {
      const data = (await json(
        "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json;api-version=7.2-preview.1",
          },
          body: JSON.stringify({
            filters: [
              { criteria: [{ filterType: 7, value: "kirana-style.kirana" }] },
            ],
            flags: 1,
          }),
        }
      )) as { results: { extensions: { versions: { version: string }[] }[] }[] }
      return (data.results[0]?.extensions ?? []).some((extension) =>
        extension.versions.some((entry) => entry.version === version)
      )
    },
  },
]

/**
 * Registries index on their own schedule (Packagist crawls the tag); wait up to half an hour for
 * the required ones.
 */
const DEADLINE = Date.now() + (once ? 0 : 30 * 60_000)
const PAUSE = 15_000

const pending = new Map(checks.map((check) => [check.name, check]))
const requiredPending = () =>
  [...pending.values()].some((check) => !check.optional)

for (let attempt = 1; ; attempt++) {
  await Promise.all(
    [...pending.values()].map(async (check) => {
      try {
        if (await check.has()) {
          console.log(`✓ ${check.name} ${version}`)
          pending.delete(check.name)
        }
      } catch (error) {
        console.log(`… ${check.name}: ${(error as Error).message}`)
      }
    })
  )
  if (!requiredPending() || Date.now() >= DEADLINE) break
  console.log(
    `attempt ${attempt}: waiting for ${[...pending.keys()].join(", ")}`
  )
  await new Promise((resolve) => setTimeout(resolve, PAUSE))
}

let failed = false
for (const check of pending.values()) {
  if (check.optional) {
    console.log(
      `::${check.optional.level}::${check.name} does not have ${version} yet: ${check.optional.why}`
    )
  } else {
    console.log(`::error::${check.name} does not have ${version}`)
    failed = true
  }
}
process.exit(failed ? 1 : 0)
