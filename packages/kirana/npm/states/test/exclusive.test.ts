import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"

import { Driver } from "@kirana-style/compiler"
import { afterAll, describe, expect, it } from "vite-plus/test"

import { exclusive } from "../src/base-ui.ts"

const root = mkdtempSync(path.join(import.meta.dirname, ".app-"))
writeFileSync(path.join(root, "package.json"), '{"name":"app"}')
afterAll(() => rmSync(root, { recursive: true, force: true }))

/** A style setting one property under both of a switch's states, the keys as the vocabulary writes them. */
const SOURCE = `import { css } from "@kirana-style/core"
export const track = css({
  backgroundColor: { base: "gray", "[data-checked]": "blue", "[data-unchecked]": "silver" },
})
`

const ambiguous = (driver: Driver) =>
  driver
    .transform(path.join(root, "track.ts"), SOURCE)
    .diagnostics.filter(
      (diagnostic) => diagnostic.name === "ambiguous-precedence"
    )

describe("exclusive", () => {
  it("tells the compiler which states never hold together", () => {
    expect(ambiguous(Driver.createSync({ root }))).toHaveLength(1)
    expect(
      ambiguous(
        Driver.createSync({ root, config: { conditions: { exclusive } } })
      )
    ).toHaveLength(0)
  })
})
