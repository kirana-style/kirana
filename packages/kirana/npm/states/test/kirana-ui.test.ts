import * as published from "@kirana-ui/vocabulary/keys"
import { describe, expect, it } from "vite-plus/test"

import * as kiranaUi from "../src/kirana-ui.ts"
import { entries, SELECTOR } from "./entries.ts"

const components = (vocabulary: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(vocabulary).filter(([name]) => /^[A-Z]/.test(name))
  )

describe("kirana-ui", () => {
  it("is the vocabulary the library publishes, key for key (KF-119)", () => {
    expect(components(kiranaUi)).toEqual(components(published))
    expect(entries(kiranaUi).length).toBeGreaterThan(0)
    for (const [, , , selector] of entries(kiranaUi))
      expect(selector).toMatch(SELECTOR)
  })

  it("takes the library's exclusive groups, values of one state included (KF-121)", () => {
    const sorted = (groups: readonly (readonly string[])[]) =>
      groups.map((group) => group.join(" ")).sort()
    expect(sorted(kiranaUi.exclusive)).toEqual(sorted(published.exclusive))
    expect(kiranaUi.exclusive).toContainEqual([
      '[data-side="top"]',
      '[data-side="right"]',
      '[data-side="bottom"]',
      '[data-side="left"]',
    ])
  })

  it("says whose names it shares, and names each part's custom properties", () => {
    expect(kiranaUi.sharesNamesWith).toEqual(["base-ui"])
    expect(kiranaUi.variables.Popover.Positioner.transformOrigin).toBe(
      "--transform-origin"
    )
  })
})
