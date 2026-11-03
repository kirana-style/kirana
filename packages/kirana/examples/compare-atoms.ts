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
 *
 * A production build on the Vite and Rolldown hosts writes dense names (D-084, KF-094): its condition
 * and value hashes become codes the whole build assigns, so its names cannot equal a hashed build's.
 * Examples whose names are of one kind are compared name for name, against the first of that kind;
 * across the two kinds, each atom's shape is, which dense names keep: the property code, a target,
 * and how many conditions.
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

/** Dense names end in a value code of one or two characters; a hashed value has four. */
const isDense = (names: readonly string[]) =>
  names.some((name) => /_[0-9A-Za-z]{1,2}$/.test(name))

/**
 * A name without its hashes or codes: `k44-KFHz_kRA9` and `k44-0_3` are both `k44-c`. A target is
 * three characters in both kinds and stays; a condition segment never is (D-084).
 */
const shape = (name: string) => {
  const [property, ...segments] = name
    .slice(0, name.lastIndexOf("_"))
    .split("-")
  return [
    property,
    ...segments.map((segment) => (segment.length === 3 ? segment : "c")),
  ].join("-")
}
const shapes = (names: readonly string[]) => names.map(shape).sort()

const sets = examples.map((example) => {
  const { names } = JSON.parse(
    readFileSync(path.join(directory, `${example}.json`), "utf8")
  ) as { names: string[] }
  return { example, names, dense: isDense(names) }
})
const [first] = sets
let failed = false
for (const { example, names, dense } of sets) {
  const kin = sets.find((set) => set.dense === dense)!
  const same = JSON.stringify(names) === JSON.stringify(kin.names)
  const alike =
    JSON.stringify(shapes(names)) === JSON.stringify(shapes(first!.names))
  console.log(
    `${same && alike ? "✓" : "✗"} ${example}: ${names.length} atoms, ${dense ? "dense" : "hashed"}`
  )
  if (!same) {
    failed = true
    const missing = kin.names.filter((name) => !names.includes(name))
    const extra = names.filter((name) => !kin.names.includes(name))
    console.log(
      `  against ${kin.example}: missing ${JSON.stringify(missing)}, extra ${JSON.stringify(extra)}`
    )
  }
  if (!alike) {
    failed = true
    console.log(
      `  shapes ${JSON.stringify(shapes(names))}, ${first!.example} has ${JSON.stringify(shapes(first!.names))}`
    )
  }
}
process.exit(failed ? 1 : 0)
