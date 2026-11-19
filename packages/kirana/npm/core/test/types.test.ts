import { spawnSync } from "node:child_process"
import path from "node:path"

import { describe, expect, it } from "vite-plus/test"

const workspace = path.resolve(import.meta.dirname, "../../../../..")
const tsc = path.join(workspace, "node_modules/.bin/tsc")

/** Type checks the project in `types/<name>`, which must pass without a word. */
function check(name: string): void {
  const run = spawnSync(
    tsc,
    ["-p", path.join(import.meta.dirname, "types", name)],
    {
      encoding: "utf8",
    }
  )
  expect(run.stdout + run.stderr).toBe("")
  expect(run.status).toBe(0)
}

// Each project is type checked on its own, as an app with that type entry is: the entries declare
// for the whole program, so they cannot share the package's tsconfig.
describe("type entries", () => {
  it.each(["react", "solid", "preact", "qwik"])(
    "types props() with the class key %s compiles to (KF-047)",
    check
  )

  // One entry for both: Solid 1's JSX is `solid-js`'s, Solid 2's is `@solidjs/web`'s (KF-127).
  it.each(["solid-elements", "solid2-elements"])(
    "types sx on the elements of %s with @kirana-style/core/solid",
    check
  )
})
