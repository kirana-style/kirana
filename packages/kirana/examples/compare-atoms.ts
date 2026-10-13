/**
 * The same styles on every host (M4 exit, KRN-INT-001): every example built from the same source must
 * put the same Kirana atoms in its stylesheet, whichever bundler built it.
 *
 *   bun examples/compare-atoms.ts <directory of --atoms files> <example> <example> …
 *
 * Adapters never interpret styles (D-028), so this is what makes conformance measured on one host
 * — Vite, against the StyleX port and the Tailwind original — hold for all of them. Class names are
 * compared rather than declarations because a class name is derived from its property and value, and
 * a host's minifier rewrites the declaration text (webpack writes `#010203` for `rgb(1, 2, 3)`).
 */
import { readFileSync } from "node:fs"
import path from "node:path"

const [directory, ...examples] = process.argv.slice(2)
if (!directory || examples.length < 2) {
  console.error(
    "usage: bun examples/compare-atoms.ts <directory> <example> <example> …"
  )
  process.exit(2)
}
const sets = examples.map((example) => {
  const { names } = JSON.parse(
    readFileSync(path.join(directory, `${example}.json`), "utf8")
  ) as { names: string[] }
  return { example, names }
})
const [first] = sets
let failed = false
for (const { example, names } of sets) {
  const same = JSON.stringify(names) === JSON.stringify(first!.names)
  console.log(`${same ? "✓" : "✗"} ${example}: ${names.length} atoms`)
  if (!same) {
    failed = true
    const missing = first!.names.filter((name) => !names.includes(name))
    const extra = names.filter((name) => !first!.names.includes(name))
    console.log(
      `  missing ${JSON.stringify(missing)}, extra ${JSON.stringify(extra)}`
    )
  }
}
process.exit(failed ? 1 : 0)
