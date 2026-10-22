import * as BaseUI from "@base-ui/react"
import { css } from "@kirana-style/core"
import { describe, expect, it } from "vite-plus/test"

import * as states from "../src/base-ui.ts"
import { exclusive, Select, Switch } from "../src/base-ui.ts"
import { entries, SELECTOR } from "./entries.ts"

// This suite runs under the Kirana Vite plugin, so the vocabulary is compiled exactly as an
// application would compile it.
describe("@kirana-style/states/base-ui", () => {
  it("names only components and parts Base UI exports", () => {
    const exported = BaseUI as unknown as Record<
      string,
      Record<string, unknown>
    >
    for (const [component, part] of entries(states)) {
      expect(exported[component], component).toBeDefined()
      if (part)
        expect(exported[component]![part], `${component}.${part}`).toBeDefined()
    }
  })

  it("holds attribute selectors only, one per state or value", () => {
    const all = entries(states)
    expect(all.length).toBeGreaterThan(500)
    for (const [component, part, state, selector] of all)
      expect(selector, `${component}.${part}.${state}`).toMatch(SELECTOR)
    expect(Switch.Root.checked).toBe("[data-checked]")
    expect(Select.Popup.side.inlineEnd).toBe('[data-side="inline-end"]')
  })

  it("lists the states Base UI sets one at a time, each one of its selectors", () => {
    const selectors = new Set(
      entries(states).map(([, , , selector]) => selector)
    )
    expect(exclusive).toContainEqual(["[data-checked]", "[data-unchecked]"])
    expect(exclusive).toContainEqual(["[data-open]", "[data-closed]"])
    for (const group of exclusive)
      for (const selector of group) expect(selectors).toContain(selector)
  })

  it("compiles as condition keys", () => {
    const track = css({
      backgroundColor: { base: "gray", [Switch.Root.checked]: "blue" },
      marginTop: { [Select.Popup.side.bottom]: "4px" },
    })
    expect(String(track)).toMatch(/^k\S+( k\S+){2}$/)
  })
})
