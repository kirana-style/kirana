/**
 * Holds every installed JavaScript dependency to a licence policy, as cargo-deny does for the Rust
 * workspace (packages/kirana/deny.toml): a licence outside the list fails, naming the package, until
 * someone reviews it and either it goes or it is listed below with the reason it is acceptable.
 *
 *   bun scripts/check-licenses.ts        # what `vp run licenses` runs
 *
 * It reads `vp pm licenses list --json`, which covers everything installed: the packages Kirana
 * publishes, and the tools, examples and site that never ship.
 */
import { spawnSync } from "node:child_process"

/** Permissive licences, and the few weak or data licences any package may carry. */
const ALLOWED = new Set([
  "MIT",
  "ISC",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "Zlib",
  "Unlicense",
  "CC0-1.0",
  "BlueOak-1.0.0",
  "Python-2.0",
  "Artistic-2.0",
  // File-level copyleft, as deny.toml allows it for Lightning CSS: changes to its own files only.
  "MPL-2.0",
  // Fonts (Fontsource) and data (caniuse-lite): their own terms, nothing in our code.
  "OFL-1.1",
  "CC-BY-4.0",
])

/** Packages reviewed by name, every platform build included: none is part of a published package. */
const REVIEWED: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /^@img\/sharp-libvips-/,
    reason:
      "LGPL-3.0: libvips, loaded by sharp, which wrangler, Astro and Gatsby use for images while building",
  },
  {
    pattern: /^@vscode\/vsce-sign(-|$)/,
    reason:
      "Microsoft's licence: the signing tool inside @vscode/vsce, which packages the VS Code extension",
  },
  {
    pattern: /^linkfs$/,
    reason:
      "no licence field: a dependency of Gatsby, which only the gatsby example installs",
  },
  {
    pattern: /^svelte-toolbelt$/,
    reason:
      "no licence field, MIT in its LICENSE file: a dependency of bits-ui, which only gen:states reads",
  },
]

/** An SPDX expression is allowed when one of its `OR` alternatives has every `AND` part allowed. */
function allowed(expression: string): boolean {
  return expression
    .replace(/[()]/g, "")
    .split(/\s+OR\s+/)
    .some((alternative) =>
      alternative.split(/\s+AND\s+/).every((part) => ALLOWED.has(part.trim()))
    )
}

const list = spawnSync("vp", ["pm", "licenses", "list", "--json"], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
})
if (list.status !== 0) {
  console.error(list.stderr || "vp pm licenses list failed")
  process.exit(2)
}

type Entry = { name: string; versions: string[] }
const byLicence = JSON.parse(list.stdout) as Record<string, Entry[]>

const refused: string[] = []
let count = 0
for (const [licence, entries] of Object.entries(byLicence)) {
  for (const entry of entries) {
    count++
    if (
      allowed(licence) ||
      REVIEWED.some(({ pattern }) => pattern.test(entry.name))
    )
      continue
    refused.push(`${entry.name}@${entry.versions.join(", ")}: ${licence}`)
  }
}

if (refused.length > 0) {
  console.error(
    `${refused.length} package(s) under a licence outside the policy (scripts/check-licenses.ts):\n${refused.map((line) => `  ${line}`).join("\n")}\nReplace the package, or add it to REVIEWED with the reason it is acceptable.`
  )
  process.exit(1)
}
console.log(`licences: ${count} package(s) within the policy`)
