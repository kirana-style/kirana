import * as Ark from "@ark-ui/react"
import { css } from "@kirana-style/core"
import { describe, expect, it } from "vite-plus/test"

import * as states from "../src/ark-ui.ts"
import {
  Dialog,
  Menu,
  Progress,
  RadioGroup,
  SegmentGroup,
  Switch,
  Tabs,
} from "../src/ark-ui.ts"
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

  it("names an orientation's values, which Zag describes in prose (KF-041)", () => {
    // `@zag-js/types`' `Orientation` fixes them; a presence key would match every part.
    expect(Tabs.Root.orientation).toEqual({
      horizontal: '[data-orientation="horizontal"]',
      vertical: '[data-orientation="vertical"]',
    })
    const presence = entries(states).filter(
      ([, , , selector]) => selector === "[data-orientation]"
    )
    expect(presence).toEqual([])
  })

  it("names what a part's getter spreads from a helper, which Zag's reference leaves out (KF-087)", () => {
    // Radio Group spreads `getItemDataAttrs(props)` on the item, its text and its control; the
    // reference has no `Item` or `ItemText`, and only `data-active` on `ItemControl`.
    const item = {
      focus: "[data-focus]",
      focusVisible: "[data-focus-visible]",
      disabled: "[data-disabled]",
      readonly: "[data-readonly]",
      state: {
        checked: '[data-state="checked"]',
        unchecked: '[data-state="unchecked"]',
      },
      hover: "[data-hover]",
      invalid: "[data-invalid]",
      orientation: {
        horizontal: '[data-orientation="horizontal"]',
        vertical: '[data-orientation="vertical"]',
      },
    }
    expect(RadioGroup.Item).toEqual(item)
    expect(RadioGroup.ItemText).toEqual(item)
    expect(RadioGroup.ItemControl).toEqual({ active: "[data-active]", ...item })
    // `data-ssr` marks the server's render, and the hidden input's `data-ownedby` an id: no state.
    expect(RadioGroup).not.toHaveProperty("ItemHiddenInput")
    expect(RadioGroup.Item).not.toHaveProperty("ssr")
  })

  it("follows a const a getter writes or spreads (KF-087)", () => {
    // Menu's item indicator writes `dataState`, `checked ? "checked" : "unchecked"`; the reference
    // gives `"checked"` alone.
    expect(Menu.ItemIndicator.state).toEqual({
      checked: '[data-state="checked"]',
      unchecked: '[data-state="unchecked"]',
    })
    expect(Menu.ItemText.state).toEqual(Menu.ItemIndicator.state)
    // Progress's track spreads `progressbarProps`, a const of `connect`: its orientation is typed,
    // and its `data-state`, which a function computes, is left out.
    expect(Progress.Track).toEqual({ orientation: Tabs.Root.orientation })
  })

  it("names a component that runs another's machine by its own name (KF-087)", () => {
    // Ark UI's Segment Group runs Zag's Radio Group machine, which the reference names alone.
    expect(Object.keys(SegmentGroup)).toEqual(Object.keys(RadioGroup))
    expect(SegmentGroup.ItemControl).toEqual(RadioGroup.ItemControl)
    expect(SegmentGroup.Root.orientation.vertical).toBe(
      '[data-orientation="vertical"]'
    )
  })

  it("compiles as condition keys", () => {
    const thumb = css({
      translate: { base: "0", [Switch.Thumb.state.checked]: "1rem" },
      opacity: { [Switch.Root.disabled]: 0.5 },
    })
    expect(String(thumb)).toMatch(/^k\S+( k\S+){2}$/)
  })
})
