import * as published from "@kirana-ui/vocabulary/keys"
import { describe, expect, it } from "vite-plus/test"

import * as kiranaUi from "../src/kirana-ui.ts"
import { entries, SELECTOR } from "./entries.ts"

const components = (vocabulary: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(vocabulary).filter(([name]) => /^[A-Z]/.test(name))
  )

/** `inline-start` → `inlineStart`: a value's name as every vocabulary here writes it. */
const camel = (name: string) =>
  name.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase())

/** The published keys with each value map's names camelCased, nested objects walked. */
const camelValues = (node: unknown): unknown =>
  typeof node === "object" && node !== null
    ? Object.fromEntries(
        Object.entries(node).map(([name, child]) => [
          typeof child === "string" ? camel(name) : name,
          camelValues(child),
        ])
      )
    : node

describe("kirana-ui", () => {
  it("is the vocabulary the library publishes, key for key (KF-119)", () => {
    expect(components(kiranaUi)).toEqual(camelValues(components(published)))
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
      '[data-side="inline-start"]',
      '[data-side="inline-end"]',
    ])
  })

  it("says whose names it shares, and names each part's custom properties", () => {
    expect(kiranaUi.sharesNamesWith).toEqual(["base-ui"])
    expect(kiranaUi.variables.Popover.Positioner.transformOrigin).toBe(
      "--transform-origin"
    )
  })

  it("follows the library's releases: 0.1.1's components, parts and custom properties", () => {
    expect(Object.keys(components(kiranaUi))).toEqual(
      expect.arrayContaining(["Combobox", "DatePicker", "Menu", "Toast"])
    )
    expect(kiranaUi.Select.ScrollUpArrow).toBeDefined()
    expect(kiranaUi.variables.Slider.Thumb.position).toBe("--position")
  })

  it("names a value with a hyphen in camel case, as every vocabulary here does", () => {
    expect(kiranaUi.Popover.Positioner.side.inlineStart).toBe(
      '[data-side="inline-start"]'
    )
  })
})
