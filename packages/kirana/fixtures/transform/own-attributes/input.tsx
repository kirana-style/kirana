import { css } from "@kirana-style/core"

// The sheet writes `data-side` itself, on Base UI and React Aria alike, though Base UI's vocabulary
// names `[data-side="left"]` for its popups. Declared the project's own, the side meets React Aria's
// `[data-entering]`, and the slide is emitted for both (KF-042).
const side = '[data-side="left"]'
const starting = { base: "[data-starting-style]", aria: "[data-entering]" }

export const sheet = css({
  translate: {
    base: "0 0",
    [side]: "-100% 0",
    [starting.aria]: { [side]: "-50% 0" },
  },
  // Two vocabularies' states still never meet: left out, as exclusiveAcross declares.
  opacity: { [starting.base]: { [starting.aria]: 0 } },
})
