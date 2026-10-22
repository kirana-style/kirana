import { css } from "@kirana-style/core"
import * as Aria from "react-aria-components"
import { describe, expect, it } from "vite-plus/test"

import * as states from "../src/react-aria.ts"
import { Button, ListBoxItem, ProgressBar } from "../src/react-aria.ts"
import { entries, SELECTOR } from "./entries.ts"

// This suite runs under the Kirana Vite plugin, so the vocabulary is compiled exactly as an
// application would compile it.
describe("@kirana-style/states/react-aria", () => {
  it("names only components React Aria exports", () => {
    const exported = Aria as unknown as Record<string, unknown>
    for (const [component, part] of entries(states)) {
      expect(exported[component], component).toBeDefined()
      expect(part).toBeUndefined()
    }
  })

  it("holds selectors only, one per state or value, inherited states included", () => {
    const all = entries(states)
    expect(all.length).toBeGreaterThan(400)
    for (const [component, , state, selector] of all)
      expect(selector, `${component}.${state}`).toMatch(SELECTOR)
    expect(Button.focusVisible).toBe("[data-focus-visible]")
    // From ItemRenderProps, which ListBoxItemRenderProps extends.
    expect(ListBoxItem.selectionMode.multiple).toBe(
      '[data-selection-mode="multiple"]'
    )
    expect(ProgressBar.indeterminate).toBe(":not([aria-valuenow])")
  })

  it("compiles as condition keys", () => {
    const button = css({
      backgroundColor: { base: "white", [Button.pressed]: "gainsboro" },
      outlineStyle: { [Button.focusVisible]: "solid" },
    })
    expect(String(button)).toMatch(/^k\S+( k\S+){2}$/)
  })
})
