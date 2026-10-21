import * as BaseUI from "@base-ui/react"
import { css } from "@kirana-style/core"
import { describe, expect, it } from "vite-plus/test"

import * as states from "../src/base-ui.ts"
import { Select, Switch } from "../src/base-ui.ts"

const SELECTOR = /^\[data-[a-z]+(?:-[a-z]+)*(?:="[^"]+")?\]$/

/** Every `[component, part | undefined, state, selector]` in the vocabulary. */
function entries() {
  const out: [string, string | undefined, string, string][] = []
  const walk = (
    component: string,
    part: string | undefined,
    value: object,
    path: string[]
  ) => {
    for (const [key, inner] of Object.entries(value))
      if (typeof inner === "string")
        out.push([component, part, [...path, key].join("."), inner])
      else walk(component, part, inner, [...path, key])
  }
  for (const [component, value] of Object.entries(states)) {
    const isPart = (key: string) => /^[A-Z]/.test(key)
    for (const [key, inner] of Object.entries(value))
      if (isPart(key)) walk(component, key, inner, [])
      else if (typeof inner === "string")
        out.push([component, undefined, key, inner])
      else walk(component, undefined, inner, [key])
  }
  return out
}

// This suite runs under the Kirana Vite plugin, so the vocabulary is compiled exactly as an
// application would compile it.
describe("@kirana-style/states/base-ui", () => {
  it("names only components and parts Base UI exports", () => {
    const exported = BaseUI as unknown as Record<
      string,
      Record<string, unknown>
    >
    for (const [component, part] of entries()) {
      expect(exported[component], component).toBeDefined()
      if (part)
        expect(exported[component]![part], `${component}.${part}`).toBeDefined()
    }
  })

  it("holds attribute selectors only, one per state or value", () => {
    const all = entries()
    expect(all.length).toBeGreaterThan(500)
    for (const [component, part, state, selector] of all)
      expect(selector, `${component}.${part}.${state}`).toMatch(SELECTOR)
    expect(Switch.Root.checked).toBe("[data-checked]")
    expect(Select.Popup.side.inlineEnd).toBe('[data-side="inline-end"]')
  })

  it("compiles as condition keys", () => {
    const track = css({
      backgroundColor: { base: "gray", [Switch.Root.checked]: "blue" },
      marginTop: { [Select.Popup.side.bottom]: "4px" },
    })
    expect(String(track)).toMatch(/^k\S+( k\S+){2}$/)
  })
})
