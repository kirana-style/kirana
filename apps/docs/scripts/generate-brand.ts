/**
 * Writes every logo file from `src/brand/logo.ts`: each lockup in each colour
 * under `public/brand/`, the favicon, and the editors' brand
 * (`packages/kirana/editors/brand/brand.json`), which the language server and
 * the VS Code extension both read, so the icon in hovers, hints and views follows
 * the logo. `--check` fails when a committed file differs from what the geometry
 * produces.
 *
 * PNG and ICO renders are made from these files by `scripts/rasterize-brand.ts`,
 * which needs Chrome and so is not part of `generate`.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { LOCKUPS, VARIANTS, fileName, toSvg } from "../src/brand/logo.ts"
import type { Lockup } from "../src/brand/logo.ts"

const root = new URL("..", import.meta.url).pathname
const check = process.argv.includes("--check")

const files = new Map<string, string>()
for (const lockup of Object.keys(LOCKUPS) as Lockup[]) {
  for (const variant of VARIANTS[lockup]) {
    files.set(
      join("public/brand", fileName(lockup, variant)),
      toSvg(lockup, variant)
    )
  }
}
// The favicon and the editors' icon: the brand mark on a square, which reads on light and dark tabs alike.
const square = toSvg("square", VARIANTS.square[0]!)
files.set("public/favicon.svg", square)
files.set(
  "../../packages/kirana/editors/brand/brand.json",
  `${JSON.stringify(
    {
      "//": "Written by apps/docs/scripts/generate-brand.ts from apps/docs/src/brand/logo.ts; do not edit. The editors' own colours are in palette.json.",
      icon: square.trim(),
    },
    null,
    2
  )}\n`
)

const stale: string[] = []
for (const [path, content] of files) {
  const target = join(root, path)
  if (check) {
    const current = await readFile(target, "utf8").catch(() => "")
    if (current !== content) stale.push(path)
  } else {
    await mkdir(join(target, ".."), { recursive: true })
    await writeFile(target, content)
  }
}

if (stale.length > 0) {
  console.error(
    `brand: out of date, run \`bun run generate:brand\`:\n  ${stale.join("\n  ")}`
  )
  process.exit(1)
}
console.log(`brand: ${files.size} files ${check ? "up to date" : "written"}`)
