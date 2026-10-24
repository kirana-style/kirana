import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"

import { Driver } from "@kirana-style/compiler"
import { afterAll, describe, expect, it } from "vite-plus/test"

import * as arkUi from "../src/ark-ui.ts"
import * as baseUi from "../src/base-ui.ts"
import { exclusiveAcross } from "../src/index.ts"
import * as reactAria from "../src/react-aria.ts"

const root = mkdtempSync(path.join(import.meta.dirname, ".app-"))
writeFileSync(path.join(root, "package.json"), '{"name":"app"}')
afterAll(() => rmSync(root, { recursive: true, force: true }))

const SIDES = ["top", "bottom", "left", "right"]
const slide = (side: string) =>
  ({ top: "0 4px", bottom: "0 -4px", left: "4px 0", right: "-4px 0" })[side]

/**
 * kirana-ui's popup slide (KF-015): the look written once for Base UI and React Aria, each library's
 * first-frame key crossed with the side the popup opened on.
 */
const SOURCE = `import { css } from "@kirana-style/core"
export const popup = css({
  translate: {
    base: "0 0",
    "[data-starting-style]": {${SIDES.map((side) => `'[data-side="${side}"]': "${slide(side)}"`).join(", ")}},
    "[data-entering]": {${SIDES.map((side) => `'[data-placement="${side}"]': "${slide(side)}"`).join(", ")}},
  },
})
`

const ambiguous = (driver: Driver) =>
  driver
    .transform(path.join(root, "popup.ts"), SOURCE)
    .diagnostics.filter(
      (diagnostic) => diagnostic.name === "ambiguous-precedence"
    ).length

describe("exclusiveAcross", () => {
  it("gives one vocabulary per library: every state selector, sorted", () => {
    const [base, aria, ark] = exclusiveAcross(baseUi, reactAria, arkUi)
    expect(base).toContain("[data-starting-style]")
    expect(base).not.toContain("[data-entering]")
    expect(aria).toContain("[data-entering]")
    expect(ark).toContain("[data-placement]")
    expect(base).toEqual([...base!].sort())
    expect(
      exclusiveAcross({
        exclusive: [["[a]", "[b]"]],
        Part: { odd: "a b", none: null },
      })
    ).toEqual([[]])
  })

  it("settles the pairs of keys no single library sets together", () => {
    const vocabularies = [baseUi, reactAria]
    const exclusive = vocabularies.flatMap((vocabulary) => vocabulary.exclusive)
    expect(
      ambiguous(
        Driver.createSync({ root, config: { conditions: { exclusive } } })
      )
      // Every side of one library against every other side of the other; on the same side the
      // two slide alike, and equal values are never ambiguous.
    ).toBe(SIDES.length * (SIDES.length - 1))
    expect(
      ambiguous(
        Driver.createSync({
          root,
          config: {
            conditions: {
              exclusive,
              exclusiveAcross: exclusiveAcross(...vocabularies),
            },
          },
        })
      )
    ).toBe(0)
  })
})
