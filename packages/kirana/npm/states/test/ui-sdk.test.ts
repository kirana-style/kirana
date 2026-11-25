import { describe, expect, it } from "vite-plus/test"

import * as uiSdk from "../src/ui-sdk.ts"
import { entries, SELECTOR } from "./entries.ts"

describe("ui-sdk", () => {
  it("names each part's states from what its slots write (KF-125)", () => {
    expect(uiSdk.Popover.Content.open).toBe("[data-open]")
    expect(uiSdk.Popover.Content.side.top).toBe('[data-side="top"]')
    expect(uiSdk.Checkbox.Root.checked).toBe("[data-checked]")
    expect(uiSdk.Checkbox.Root.indeterminate).toBe("[data-indeterminate]")
    expect(uiSdk.Select.Item.highlighted).toBe("[data-highlighted]")
    // One part: its states at the top, as Base UI's Button.
    expect(uiSdk.Button.pending).toBe("[data-pending]")
    // beta.17: a dialog's close part is disabled with it.
    expect(uiSdk.Dialog.Close.disabled).toBe("[data-disabled]")
  })

  it("holds only attribute selectors, and the pairs ui-sdk never sets together", () => {
    const all = entries(uiSdk)
    expect(all.length).toBeGreaterThan(900)
    for (const [, , , selector] of all) expect(selector).toMatch(SELECTOR)
    expect(uiSdk.exclusive).toContainEqual(["[data-open]", "[data-closed]"])
    expect(all.some(([, , , selector]) => selector === "[data-slot]")).toBe(
      false
    )
  })
})
