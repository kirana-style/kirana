import { css } from "@kirana-style/core"

// A popup's first frame written once for two libraries, each state nested in every side: a
// combination of one library's frame and the other's side matches no element, and is left out.
export const popup = css({
  translate: {
    "[data-starting-style]": {
      '[data-side="top"]': "0 4px",
      '[data-placement="top"]': "0 8px",
    },
    "[data-entering]": {
      '[data-placement="top"]': "0 4px",
      '[data-side="top"]': "0 8px",
    },
  },
})

// Two values of one attribute never meet either.
export const side = css({ opacity: { '[data-side="top"]': { '[data-side="bottom"]': 0 } } })
