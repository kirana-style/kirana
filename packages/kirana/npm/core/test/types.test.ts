import { spawnSync } from "node:child_process"
import path from "node:path"

import { describe, expect, it } from "vite-plus/test"

const workspace = path.resolve(import.meta.dirname, "../../../../..")
const tsc = path.join(workspace, "node_modules/.bin/tsc")

// Each project is type checked on its own, as an app with that type entry is: the entries declare
// for the whole program, so they cannot share the package's tsconfig.
describe("type entries", () => {
  it.each(["react", "solid", "preact", "qwik"])(
    "types props() with the class key %s compiles to (KF-047)",
    (framework) => {
      const run = spawnSync(
        tsc,
        ["-p", path.join(import.meta.dirname, "types", framework)],
        { encoding: "utf8" }
      )
      expect(run.stdout + run.stderr).toBe("")
      expect(run.status).toBe(0)
    }
  )
})
