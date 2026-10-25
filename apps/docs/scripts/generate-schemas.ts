/**
 * Writes the component registry's JSON Schemas under `public/schema/`, so the site serves each at
 * its `$id` (`https://kirana.style/schema/registry-item.json` …), from the objects
 * `@kirana-style/registry` checks documents with: one definition, published where editors and other
 * tools look for it. `--check` fails when a committed file differs.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import * as schemas from "../../../packages/kirana/npm/registry/src/schema.ts"
import type { Schema } from "../../../packages/kirana/npm/registry/src/schema.ts"

const root = new URL("..", import.meta.url).pathname
const check = process.argv.includes("--check")
const BASE = "https://kirana.style/schema/"

const files = new Map<string, string>()
for (const value of Object.values(schemas)) {
  const id = (value as Schema).$id
  if (typeof id !== "string") continue
  if (!id.startsWith(BASE)) throw new Error(`${id} is not under ${BASE}`)
  files.set(
    join("public/schema", id.slice(BASE.length)),
    `${JSON.stringify(value, null, 2)}\n`
  )
}
if (files.size === 0)
  throw new Error("no schema found in @kirana-style/registry/schema")

let stale = false
for (const [name, text] of files) {
  const path = join(root, name)
  const current = await readFile(path, "utf8").catch(() => undefined)
  if (current === text) continue
  stale = true
  if (check)
    console.error(`${name} is stale. Run \`bun run generate:schemas\`.`)
  else {
    await mkdir(join(root, "public/schema"), { recursive: true })
    await writeFile(path, text)
  }
}

if (check && stale) process.exit(1)
console.log(`schemas: ${files.size}${check ? " up to date" : ""}`)
