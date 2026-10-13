import { describe, expect, it } from "vitest"

import { createSx, sx } from "../src/index.ts"
import kiranaEmber, { EMBER_EXTERNALS, TEMPLATE_TAG } from "../src/vite.ts"

describe("D-072 Kirana for Ember", () => {
  it("merges handles in templates, later winning, without tombstones", () => {
    expect(sx("k3_aaaa k1x_bbbb", "k3_cccc")).toBe("k1x_bbbb k3_cccc")
    expect(sx("k3_aaaa", null, false, undefined, "k3_")).toBe("")
    // A handle with runtime values keeps its classes; its variables are the component's to set.
    expect(sx({ c: "k3_aaaa", v: { "--k3": "red" } })).toBe("k3_aaaa")
    expect(sx()).toBe("")
    expect(createSx("app")("app3_aaaa k3_bbbb", "app3_cccc")).toBe(
      "k3_bbbb app3_cccc"
    )
  })

  it("runs after Embroider, takes template-tag modules and Ember's own as runtime values", () => {
    const [main, late] = kiranaEmber({ config: { externals: ["virtual:"] } })
    expect(main!.enforce).toBe("post")
    expect(late!.name).toBe("kirana:late")
    const include = (
      main!.transform as { filter: { id: { include: RegExp[] } } }
    ).filter.id.include
    expect(include).toContain(TEMPLATE_TAG)
    expect(include.some((pattern) => pattern.test("app/x.ts"))).toBe(true)
    expect(TEMPLATE_TAG.test("app/templates/application.gjs")).toBe(true)
    expect(TEMPLATE_TAG.test("app/components/card.gts?t=1")).toBe(true)
    expect(TEMPLATE_TAG.test("app/x.js")).toBe(false)
    expect(kiranaEmber()).toHaveLength(2)
    expect(EMBER_EXTERNALS).toContain("@ember/")
  })
})
