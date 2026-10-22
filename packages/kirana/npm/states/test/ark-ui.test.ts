import * as Ark from "@ark-ui/react"
import { css } from "@kirana-style/core"
import { describe, expect, it } from "vite-plus/test"

import * as states from "../src/ark-ui.ts"
import { Dialog, Switch } from "../src/ark-ui.ts"
import { entries, SELECTOR } from "./entries.ts"

// This suite runs under the Kirana Vite plugin, so the vocabulary is compiled exactly as an
// application would compile it.
describe("@kirana-style/states/ark-ui", () => {
  it("names only components and parts Ark UI exports", () => {
    const exported = Ark as unknown as Record<string, Record<string, unknown>>
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
    expect(Switch.Root.state.checked).toBe('[data-state="checked"]')
    expect(Dialog.Content.state.open).toBe('[data-state="open"]')
    // Zag marks one state with the values of one attribute, which need no exclusive group.
    expect(states.exclusive).toEqual([])
  })

  it("compiles as condition keys", () => {
    const thumb = css({
      translate: { base: "0", [Switch.Thumb.state.checked]: "1rem" },
      opacity: { [Switch.Root.disabled]: 0.5 },
    })
    expect(String(thumb)).toMatch(/^k\S+( k\S+){2}$/)
  })
})
