import { css, own } from "@kirana-style/core"
import * as kirana from "@kirana-style/core"

// Base UI names `[data-side="left"]` for its popups, so the across rule keeps it apart from React
// Aria's `[data-entering]`: a popup's slide, written once for both, leaves that pair out.
const side = '[data-side="left"]'
const starting = { base: "[data-starting-style]", aria: "[data-entering]" }

export const popup = css({
  translate: { [starting.aria]: { [side]: "0 -4px" } },
})

// The sheet writes `data-side` itself, on every library: claimed for its style alone (KF-044), its
// side meets React Aria's entering state, and the slide is emitted. The popup's is still left out.
export const sheet = css(own("data-side"), {
  translate: { base: "0 0", [starting.aria]: { [side]: "-50% 0" } },
})

// A style built on the sheet's handle keeps the claim.
export const wide = css(sheet, { width: { [starting.aria]: { [side]: "80%" } } })

// The claim anywhere among the arguments, once however often it is made, and through an array.
export const after = css({ height: { [starting.aria]: { [side]: "1px" } } }, own("data-side", "data-side"))
export const twice = css(own("data-side"), own("data-side"), { top: { [starting.aria]: { [side]: 0 } } })
export const listed = css([sheet], { left: { [starting.aria]: { [side]: 0 } } })

// Through the namespace, as any other export.
export const namespaced = kirana.css(kirana.own("data-side"), {
  bottom: { [starting.aria]: { [side]: 0 } },
})

// Two vocabularies' states still never meet, claimed or not.
export const fade = css(own("data-side"), { opacity: { [starting.base]: { [starting.aria]: 0 } } })

// An attribute name, not a selector; and at least one.
export const wrong = css(own('[data-side="left"]', 1 as never), own())
